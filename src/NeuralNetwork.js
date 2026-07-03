const sig = x => 1 / (1 + Math.exp(-x));
const sigPrime = x => {
    const s = sig(x);
    return s * (1 - s);
};

class NeuralNetwork {
    constructor(layerSizes, rng, outputActivation) {
        this.layerSizes = layerSizes;
        this.numLayers = layerSizes.length;
        this.rng = rng;
        this.outputActivation = outputActivation || 'linear';
        this.weights = [];
        this.biases = [];
        for (let l = 1; l < this.numLayers; l++) {
            const prev = layerSizes[l - 1];
            const curr = layerSizes[l];
            const w = Array.from({ length: curr }, () =>
                Array.from({ length: prev }, () => this.rng.randn() * 0.5));
            const b = Array.from({ length: curr }, () => this.rng.randn() * 0.1);
            this.weights.push(w);
            this.biases.push(b);
        }
        this.zs = [];
        this.as = [];
        this.deltas = [];
        this.weightGradients = [];
        this.biasGradients = [];
        this.input = null;
        this.target = null;
        this.loss = null;
        this.lastUpdate = null;
        this.phase = 'idle';
    }

    forward(input) {
        this.input = input.slice();
        this.zs = [];
        this.as = [input.slice()];
        for (let l = 0; l < this.weights.length; l++) {
            const w = this.weights[l];
            const b = this.biases[l];
            const prevA = this.as[this.as.length - 1];
            const z = w.map(row => {
                let sum = 0;
                for (let j = 0; j < row.length; j++) {
                    sum += row[j] * prevA[j];
                }
                const rowIdx = w.indexOf(row);
                return sum + b[rowIdx];
            });
            this.zs.push(z);
            const isLast = l === this.weights.length - 1;
            if (isLast && this.outputActivation === 'linear') {
                this.as.push(z.slice());
            } else {
                this.as.push(z.map(sig));
            }
        }
        this.phase = 'forward';
        return this.as[this.as.length - 1];
    }

    backward(target) {
        this.target = target.slice();
        const L = this.weights.length;
        const output = this.as[L];
        const deriv = i => this.outputActivation === 'linear'
            ? 1 : sigPrime(this.zs[L - 1][i]);
        let delta = output.map((o, i) => (o - target[i]) * deriv(i));
        this.deltas = [delta.slice()];
        for (let l = L - 2; l >= 0; l--) {
            const nextW = this.weights[l + 1];
            const z = this.zs[l];
            const sp = z.map(sigPrime);
            const prevDelta = this.deltas[this.deltas.length - 1];
            const newDelta = Array.from(
                { length: this.layerSizes[l + 1] },
                (_, i) => {
                    let sum = 0;
                    for (let j = 0; j < nextW.length; j++) {
                        sum += nextW[j][i] * prevDelta[j];
                    }
                    return sum * sp[i];
                }
            );
            this.deltas.unshift(newDelta);
        }
        this.weightGradients = [];
        this.biasGradients = [];
        for (let l = 0; l < L; l++) {
            const aPrev = this.as[l];
            const d = this.deltas[l];
            const wg = d.map(dj => aPrev.map(ai => dj * ai));
            const bg = d.slice();
            this.weightGradients.push(wg);
            this.biasGradients.push(bg);
        }
        this.loss = output.reduce(
            (s, o, i) => s + (o - target[i]) ** 2, 0
        ) / target.length;
        this.phase = 'backward';
        return this.weightGradients;
    }

    update(lr) {
        this.lastUpdate = { weights: [], biases: [] };
        for (let l = 0; l < this.weights.length; l++) {
            const wup = this.weights[l].map((row, i) =>
                row.map((w, j) => -lr * this.weightGradients[l][i][j]));
            const bup = this.biases[l].map((b, i) =>
                -lr * this.biasGradients[l][i]);
            this.lastUpdate.weights.push(wup.map(r => r.slice()));
            this.lastUpdate.biases.push(bup.slice());
            for (let i = 0; i < this.weights[l].length; i++) {
                for (let j = 0; j < this.weights[l][i].length; j++) {
                    this.weights[l][i][j] += wup[i][j];
                }
            }
            for (let i = 0; i < this.biases[l].length; i++) {
                this.biases[l][i] += bup[i];
            }
        }
        this.phase = 'updated';
        return this.lastUpdate;
    }

    reset(rng) {
        if (rng) this.rng = rng;
        for (let l = 1; l < this.numLayers; l++) {
            const prev = this.layerSizes[l - 1];
            const curr = this.layerSizes[l];
            for (let i = 0; i < curr; i++) {
                for (let j = 0; j < prev; j++) {
                    this.weights[l - 1][i][j] = this.rng.randn() * 0.5;
                }
                this.biases[l - 1][i] = this.rng.randn() * 0.1;
            }
        }
        this.zs = [];
        this.as = [];
        this.deltas = [];
        this.weightGradients = [];
        this.biasGradients = [];
        this.input = null;
        this.target = null;
        this.loss = null;
        this.lastUpdate = null;
        this.phase = 'idle';
    }

    getNeuronInfo(layerIdx, neuronIdx) {
        if (layerIdx < 1 || layerIdx >= this.numLayers) return null;
        const wLayer = this.weights[layerIdx - 1];
        const prevSize = this.layerSizes[layerIdx - 1];
        const info = {
            layerIdx,
            neuronIdx,
            layerName: layerIdx === this.numLayers - 1
                ? '출력' : `은닉${layerIdx}`,
            bias: this.biases[layerIdx - 1][neuronIdx],
            biasGrad: this.biasGradients.length
                ? this.biasGradients[layerIdx - 1][neuronIdx]
                : null,
            biasUpdate: this.lastUpdate
                ? this.lastUpdate.biases[layerIdx - 1][neuronIdx]
                : null,
            weights: [],
            activation: this.as.length > layerIdx
                ? this.as[layerIdx][neuronIdx]
                : null,
            z: this.zs.length >= layerIdx
                ? this.zs[layerIdx - 1][neuronIdx]
                : null,
            delta: this.deltas.length >= layerIdx
                && this.deltas[layerIdx - 1]
                ? this.deltas[layerIdx - 1][neuronIdx]
                : null,
        };
        for (let j = 0; j < prevSize; j++) {
            const w = wLayer[neuronIdx][j];
            const prevA = this.as.length > layerIdx - 1
                ? this.as[layerIdx - 1][j]
                : null;
            const grad = this.weightGradients.length
                ? this.weightGradients[layerIdx - 1][neuronIdx][j]
                : null;
            const upd = this.lastUpdate
                ? this.lastUpdate.weights[layerIdx - 1][neuronIdx][j]
                : null;
            info.weights.push({ fromIdx: j, w, prevA, grad, upd });
        }
        return info;
    }

    static sig = sig;
    static sigPrime = sigPrime;
}

export default NeuralNetwork;
