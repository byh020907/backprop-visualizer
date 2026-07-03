import NeuralNetwork from './NeuralNetwork.js';
import SeededRandom from './SeededRandom.js';

export default function appStore({ viz }) {
    return {
        // ---- config ----
        inputSize: 3,
        hiddenLayers: '3,3',
        outputSize: 3,
        inputValues: '1,2,3',
        targetValues: '10,20,60',
        learningRate: 0.05,
        seed: 42,
        outputActivation: 'linear',
        displayMode: 'all',
        edgeScale: 2.0,
        autoInterval: 800,

        // ---- state ----
        nn: null,
        viz,
        selectedNeuron: null,
        dpData: null,
        statusMsg: '네트워크를 초기화하세요',
        loss: '—',
        output: '—',
        actDisplay: '변환없음',
        phase: '⏸ 대기',
        autoTimer: null,
        autoRunning: false,

        // ---- lifecycle ----
        init() {
            this.$nextTick(() => {
                this.viz.resize();
                this.initNetwork();
                this.$watch('displayMode', () => this.redraw());
                this.$watch('edgeScale', () => this.redraw());
                this.$watch('inputValues', () => this.redraw());
                this.$watch('targetValues', () => this.redraw());
                this.$watch('learningRate', () => this.redraw());
            });
        },

        // ---- helpers ----
        redraw() {
            if (!this.nn) return;
            this.viz.draw(this.nn, {
                displayMode: this.displayMode,
                edgeScale: this.edgeScale,
                selectedNeuron: this.selectedNeuron,
            });
        },

        parseLayers() {
            const inputSize = parseInt(this.inputSize) || 2;
            const hiddenStr = this.hiddenLayers.trim();
            const hidden = hiddenStr
                ? hiddenStr.split(',').map(s => parseInt(s.trim())).filter(n => n > 0)
                : [];
            const outputSize = parseInt(this.outputSize) || 1;
            return [inputSize, ...hidden, outputSize];
        },

        updateStatus() {
            if (!this.nn) return;
            if (this.nn.loss !== null) {
                this.loss = this.nn.loss.toFixed(6);
            }
            if (this.nn.as.length > 0) {
                const out = this.nn.as[this.nn.as.length - 1];
                this.output = `[${out.map(v => v.toFixed(4)).join(', ')}]`;
            }
            const phases = {
                idle: '⏸ 대기',
                forward: '▶ 앞으로 계산',
                backward: '◀ 오차 역전파',
                updated: '⚡ 가중치 갱신',
            };
            this.phase = phases[this.nn.phase] || '대기';
        },

        stopAuto() {
            if (this.autoTimer) {
                clearInterval(this.autoTimer);
                this.autoTimer = null;
                this.autoRunning = false;
            }
        },

        // ---- network operations ----
        initNetwork() {
            this.stopAuto();
            this.hideDetail();
            const layers = this.parseLayers();
            const rng = new SeededRandom(this.seed);
            this.nn = new NeuralNetwork(layers, rng, this.outputActivation);
            const input = this.inputValues.trim()
                .split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
            const target = this.targetValues.trim()
                .split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
            let msg = [];
            if (input.length !== layers[0]) {
                msg.push(`입력값 개수(${input.length})가 입력층(${layers[0]})과 다름`);
            }
            if (target.length !== layers[layers.length - 1]) {
                msg.push(`목표값 개수(${target.length})가 출력층(${layers[layers.length - 1]})과 다름`);
            }
            this.nn.input = input.length ? input : Array(layers[0]).fill(0);
            this.nn.target = target.length ? target : Array(layers[layers.length - 1]).fill(0);
            this.actDisplay = this.outputActivation === 'linear' ? '변환없음' : '시그모이드';
            this.statusMsg = msg.length ? '⚠ ' + msg.join(' ') : '네트워크 생성 완료';
            this.loss = '—';
            this.output = '—';
            this.updateStatus();
            this.redraw();
        },

        doForward() {
            if (!this.nn) return this.initNetwork();
            if (!this.nn.input
                || this.nn.input.length !== this.nn.layerSizes[0]) {
                const input = this.inputValues.trim()
                    .split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
                if (input.length === this.nn.layerSizes[0]) {
                    this.nn.input = input;
                }
            }
            this.nn.forward(this.nn.input);
            this.statusMsg = '앞으로 계산 완료';
            this.updateStatus();
            this.redraw();
        },

        doBackward() {
            if (!this.nn || this.nn.phase === 'idle') {
                this.doForward();
                if (!this.nn) return;
            }
            const target = this.targetValues.trim()
                .split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
            const outSize = this.nn.layerSizes[this.nn.layerSizes.length - 1];
            if (target.length !== outSize) {
                this.statusMsg = `⚠ 목표값 개수(${target.length}) 불일치`;
                return;
            }
            this.nn.target = target;
            this.nn.backward(this.nn.target);
            this.statusMsg = `오차 역전파 완료  |  오차(MSE): ${this.nn.loss.toFixed(6)}`;
            this.updateStatus();
            this.redraw();
        },

        doUpdate() {
            if (!this.nn
                || this.nn.phase === 'idle'
                || this.nn.phase === 'forward') {
                this.doBackward();
            }
            if (!this.nn) return;
            this.nn.update(this.learningRate);
            this.statusMsg = `가중치 업데이트 완료  |  학습률=${this.learningRate}`;
            this.updateStatus();
            this.redraw();
        },

        doStep() {
            if (!this.nn) this.initNetwork();
            this.doForward();
            this.doBackward();
            this.doUpdate();
            this.doForward();
            if (this.nn) {
                this.statusMsg = `한 바퀴 완료  |  오차: ${this.nn.loss.toFixed(6)}`;
            }
            this.updateStatus();
            this.redraw();
            if (this.selectedNeuron) {
                this.recomputeDetail();
            }
        },

        resetNetwork() {
            this.stopAuto();
            this.hideDetail();
            if (this.nn) {
                this.nn.reset(new SeededRandom(this.seed));
                this.statusMsg = '초기화 (난수 재설정)';
            } else {
                this.initNetwork();
            }
            this.loss = '—';
            this.output = '—';
            this.phase = '⏸ 대기';
            this.redraw();
        },

        toggleAuto() {
            if (this.autoRunning) {
                this.stopAuto();
                return;
            }
            if (!this.nn) this.initNetwork();
            this.autoRunning = true;
            this.autoTimer = setInterval(() => {
                if (!this.nn) this.initNetwork();
                this.doStep();
            }, this.autoInterval);
        },

        // ---- canvas click ----
        onCanvasClick(e) {
            if (!this.viz.lastPositions) return;
            const rect = e.target.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const node = this.viz.getNeuronAt(mx, my);
            if (node && node.layer > 0) {
                this.selectNeuron(node.layer, node.idx);
            } else {
                this.hideDetail();
            }
        },

        // ---- detail panel ----
        selectNeuron(layer, idx) {
            if (!this.nn) return;
            this.selectedNeuron = { layer, idx };
            this.recomputeDetail();
            this.redraw();
        },

        hideDetail() {
            this.selectedNeuron = null;
            this.dpData = null;
            this.redraw();
        },

        recomputeDetail() {
            if (!this.selectedNeuron || !this.nn) {
                this.dpData = null;
                return;
            }
            const { layer, idx } = this.selectedNeuron;
            const info = this.nn.getNeuronInfo(layer, idx);
            if (!info) {
                this.dpData = null;
                return;
            }

            const layerLabel = info.layerIdx === this.nn.layerSizes.length - 1
                ? '출력' : `은닉${info.layerIdx}`;
            const d = info.delta;

            // ---- ① formula ----
            let formulaHtml = '';
            if (d !== null) {
                const isOutput = info.layerIdx === this.nn.layerSizes.length - 1;
                if (isOutput) {
                    const out = this.nn.as[this.nn.as.length - 1][idx];
                    const target = this.nn.target ? this.nn.target[idx] : '?';
                    const error = out - (typeof target === 'number' ? target : 0);
                    const targetStr = typeof target === 'number'
                        ? target.toFixed(4) : String(target);
                    if (this.nn.outputActivation === 'linear') {
                        formulaHtml
                            = `이 뉴런의 오차 = (출력값 - 목표값) × 변화율\n`
                            + `  = (${out.toFixed(4)} - ${targetStr}) × 1\n`
                            + `  = <span class="hl3">${d.toFixed(6)}</span>\n`
                            + `\n→ 출력이 목표보다 `
                            + `${out > target ? '크면' : '작으면'} (+)오차, `
                            + `${out < target ? '크면' : '작으면'} (-)오차`
                            + `\n\n왜 ×1? → Linear는 출력을 그대로 전달해서 변화율이 항상 1`;
                    } else {
                        const sig = NeuralNetwork.sig;
                        const z = info.z;
                        const sp = (s => s * (1 - s))(sig(z));
                        formulaHtml
                            = `이 뉴런의 오차 = (출력값 - 목표값) × 시그모이드 변화율\n`
                            + `  = (${out.toFixed(4)} - ${targetStr}) × ${sp.toFixed(4)}\n`
                            + `  = ${error.toFixed(6)} × ${sp.toFixed(4)}\n`
                            + `  = <span class="hl3">${d.toFixed(6)}</span>\n`
                            + `\n→ 시그모이드는 0,1 근처에서 둔감해서 변화율이 작아짐`
                            + `\n\n왜 ×변화율? → 출력이 0.9면 이미 충분히 큼. 변화율 0.09로 조정을 줄임`;
                    }
                } else {
                    const nextW = this.nn.weights[info.layerIdx];
                    const nextDeltas = this.nn.deltas[info.layerIdx];
                    if (nextW && nextDeltas) {
                        const terms = nextW.map((row, k) => {
                            return `${row[idx].toFixed(4)}×${nextDeltas[k].toFixed(4)}`;
                        });
                        const sum = nextW.reduce(
                            (s, row, k) => s + row[idx] * nextDeltas[k], 0);
                        const a = info.activation;
                        const spVal = a !== null ? a * (1 - a) : '?';
                        const nextLayerName
                            = info.layerIdx === this.nn.layerSizes.length - 2
                                ? '출력층' : `은닉${info.layerIdx + 1}층`;
                        formulaHtml
                            = `이 뉴런의 오차 = [다음 층 오차들 × 연결가중치 합] × 활성화 변화율\n`
                            + `  = [${terms.join(' + ')}]\n`
                            + `  = ${sum.toFixed(6)}\n`
                            + `  × ${typeof spVal === 'number' ? spVal.toFixed(6) : spVal}  (= a×(1-a))\n`
                            + `  = <span class="hl3">${d.toFixed(6)}</span>\n`
                            + `\n→ <span class="hl2">${nextLayerName}</span>`
                            + `의 오차들이 가중치를 타고 <span class="hl2">역으로 전파</span>됨`
                            + `\n\n왜 ×a×(1-a)? → 시그모이드 민감도. 출력 0.5일 때 가장 민감(0.25)`
                            + `\n\n⚠ 자주 하는 착각:\n`
                            + `"가중치가 크면 오차도 많이 받아야 하지 않나?"\n`
                            + `→ 순전파: z = (w₁×a₁) + (w₂×a₂) + ...\n`
                            + `  a₁이 출력에 미친 영향 = w₁ (곱해진 값)\n`
                            + `→ 역전파시 <이전 뉴런에 오차를 보낼 때>는\n`
                            + `  'w₁이 통로' 역할: a₁이 기여한 만큼(w₁) 오차를 보냄\n`
                            + `  그래서 이전 뉴런의 오차 = w₁ × (다음뉴런오차)`;
                    }
                }
            } else {
                formulaHtml = '아직 역전파 전입니다. ◀ 역전파 버튼을 누르세요.';
            }

            // ---- ② weight table rows ----
            const grads = info.weights.map(
                w => Math.abs(w.grad !== null ? w.grad : 0));
            const totalGrad = grads.reduce((s, v) => s + v, 0);
            const weightRows = info.weights.map((w, i) => {
                const prevLayer = info.layerIdx - 1;
                const fromName = prevLayer === 0
                    ? `입력${w.fromIdx}`
                    : `은닉${prevLayer}#${w.fromIdx}`;
                const wStr = w.w.toFixed(4);
                const prevAStr = w.prevA !== null ? w.prevA.toFixed(4) : '?';
                const gradStr = w.grad !== null ? w.grad.toFixed(5) : '—';
                const updStr = w.upd !== null ? w.upd.toFixed(5) : '—';
                const ratio = totalGrad > 0 ? (grads[i] / totalGrad * 100) : 0;
                const hasGrad = w.grad !== null && Math.abs(w.grad) > 0.0001;
                const gradStyle = hasGrad
                    ? 'color:#9a6700;font-weight:600'
                    : '';
                const ratioBarWidth = Math.max(ratio * 2, ratio > 0 ? 4 : 0);
                return { fromName, wStr, prevAStr, gradStr, updStr,
                    gradStyle, ratio, ratioBarWidth };
            });

            // ---- ② example ----
            let weightExample = '';
            if (d !== null && info.weights.length > 0) {
                const first = info.weights[0];
                if (first.grad !== null && first.prevA !== null) {
                    const prevLayer = info.layerIdx - 1;
                    const fromName = prevLayer === 0
                        ? `입력${first.fromIdx}`
                        : `은닉${prevLayer}#${first.fromIdx}`;
                    const lr = this.learningRate;
                    weightExample
                        = `① 오차영향 = (이뉴런오차) × (${fromName}출력)\n`
                        + `            = (${d.toFixed(4)}) × (${first.prevA.toFixed(4)})\n`
                        + `            = ${first.grad.toFixed(5)}`;
                    if (first.upd !== null) {
                        weightExample
                            += `\n\n② 변화량 = -학습률 × 오차영향\n`
                            + `          = -${lr} × (${first.grad.toFixed(5)})\n`
                            + `          = ${first.upd.toFixed(5)}\n`
                            + `   (오차영향이 (+)면 가중치를 줄이고,\n`
                            + `    (-)면 가중치를 늘려서 오차를 최소화)\n`
                            + `\n③ 새 가중치 = (기존가중치) + (변화량)\n`
                            + `              = (${first.w.toFixed(4)}) + (${first.upd.toFixed(5)})\n`
                            + `              = ${(first.w + first.upd).toFixed(5)}`
                            + `\n\n📌 왜 입력값만 곱할까?\n`
                            + `"w₁을 수정"하려면 "w₁이 z에 얼마나 기여했는지"가 필요\n`
                            + `z = (w₁×a₁) + (w₂×a₂) + ... 에서\n`
                            + `w₁이 기여한 부분 = w₁×a₁ (a₁은 고정, w₁이 변수)\n`
                            + `w₁의 계수 = a₁ → 따라서 입력값 a₁만 남음\n`
                            + `→ 오차영향 = 이뉴런오차 × 연결된입력값`
                            + `\n\n⚠ 자주 하는 착각 (가중치 업데이트):\n`
                            + `"w₁=0.8, w₂=0.2이면 w₁을 4배 더 바꿔야지?"\n`
                            + `→ 아니요. w₁은 이번에 '수정 대상'이지 '통로'가 아님\n`
                            + `→ w₁이 오차에 기여한 만큼 = w₁을 타고 들어온 입력(a₁)\n`
                            + `  (순전파: w₁×a₁, 이 값이 z에 더해짐)\n`
                            + `→ w₁ 변화량 = 학습률 × 오차 × a₁\n`
                            + `→ w₁ 자신의 크기(0.8)는 관계없고, 입력 a₁이 결정함`;
                    }
                }
            }

            // ---- ③ bias ----
            const bgStr = info.biasGrad !== null
                ? info.biasGrad.toFixed(5) : '—';
            const buStr = info.biasUpdate !== null
                ? info.biasUpdate.toFixed(5) : '—';
            const hasBiasGrad = info.biasGrad !== null
                && Math.abs(info.biasGrad) > 0.0001;
            const biasGradStyle = hasBiasGrad
                ? 'color:#9a6700;font-weight:600'
                : '';

            let biasExample = '';
            if (d !== null) {
                biasExample
                    = `바이어스는 가중치와 달리 곱해지는 입력값이 없어서\n`
                    + `오차영향 = 이뉴런오차(${d.toFixed(4)}) 그 자체\n`
                    + `변화량 = -${this.learningRate} × (${d.toFixed(4)})`
                    + ` = ${(-this.learningRate * d).toFixed(5)}`
                    + `\n\n왜 바이어스? → 각 뉴런의 기준점(활성화 임계값)을 조정`;
            }

            // ---- ④ activation ----
            let activationText = '';
            if (info.z !== null) {
                const terms = info.weights.map(w => {
                    return `${w.w.toFixed(3)}×${
                        w.prevA !== null ? w.prevA.toFixed(3) : '?'}`;
                });
                activationText
                    = `가중합(z) = ${terms.join(' + ')} + 편향(${info.bias.toFixed(3)})\n`
                    + `         = ${info.z.toFixed(4)}\n`;
                const isOutput = info.layerIdx === this.nn.layerSizes.length - 1;
                const isLinear = isOutput
                    && this.nn.outputActivation === 'linear';
                if (isLinear) {
                    activationText
                        += `출력(a) = z = ${
                            info.activation !== null
                                ? info.activation.toFixed(4) : '?'}  (변환없음)`;
                } else {
                    activationText
                        += `출력(a) = 시그모이드(z) = 1/(1+e^(${-info.z.toFixed(4)})) = ${
                            info.activation !== null
                                ? info.activation.toFixed(4) : '?'}`;
                }
                if (d !== null) {
                    activationText
                        += `\n\n활성화 변화율 = a×(1-a) = ${
                            info.activation !== null
                                ? (info.activation * (1 - info.activation)).toFixed(6)
                                : '?'}`;
                }
            } else {
                activationText = '순전파를 먼저 실행하세요 (▶ 버튼)';
            }

            this.dpData = {
                title: `${layerLabel}층 · 뉴런 #${idx}`,
                formulaHtml,
                weightRows,
                weightExample,
                biasData: {
                    b: info.bias.toFixed(4),
                    bgStr,
                    buStr,
                    hasGrad: hasBiasGrad,
                    gradStyle: biasGradStyle,
                },
                biasExample,
                activationText,
            };
        },
    };
}
