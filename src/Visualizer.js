class Visualizer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.dpr = 1;
        this.lastPositions = null;
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this._dragPrev = null;
        this._dragMoved = false;
        this._rafId = null;
        this.onChange = null;
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this._bindEvents();
    }

    _bindEvents() {
        const c = this.canvas;

        c.addEventListener('wheel', e => {
            e.preventDefault();
            const rect = c.getBoundingClientRect();
            const cx = e.clientX - rect.left;
            const cy = e.clientY - rect.top;
            const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
            const next = this.zoom * factor;
            if (next < 0.2 || next > 5) return;
            this.panX = cx - (cx - this.panX) * (next / this.zoom);
            this.panY = cy - (cy - this.panY) * (next / this.zoom);
            this.zoom = next;
            this._scheduleUpdate();
        }, { passive: false });

        c.addEventListener('mousedown', e => {
            e.preventDefault();
            this._dragPrev = { x: e.clientX, y: e.clientY };
            this._dragMoved = false;
            c.style.cursor = 'grabbing';
        });

        c.addEventListener('mousemove', e => {
            if (!this._dragPrev) return;
            const dx = e.clientX - this._dragPrev.x;
            const dy = e.clientY - this._dragPrev.y;
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
                this._dragMoved = true;
            }
            this.panX += dx;
            this.panY += dy;
            this._dragPrev = { x: e.clientX, y: e.clientY };
            this._scheduleUpdate();
        });

        const endDrag = () => {
            if (this._dragPrev) {
                this._dragPrev = null;
                c.style.cursor = 'default';
            }
        };
        c.addEventListener('mouseup', endDrag);
        c.addEventListener('mouseleave', endDrag);

        c.addEventListener('dblclick', e => {
            this.zoom = 1;
            this.panX = 0;
            this.panY = 0;
            this._dragMoved = false;
            this._scheduleUpdate();
        });
    }

    _scheduleUpdate() {
        if (this._rafId) return;
        this._rafId = requestAnimationFrame(() => {
            this._rafId = null;
            if (this.onChange) this.onChange();
        });
    }

    screenToWorld(sx, sy) {
        return {
            x: (sx - this.panX) / this.zoom,
            y: (sy - this.panY) / this.zoom,
        };
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.dpr = 1;
        this.w = rect.width;
        this.h = rect.height;
        this.canvas.width = this.w * this.dpr;
        this.canvas.height = this.h * this.dpr;
        this.canvas.style.width = this.w + 'px';
        this.canvas.style.height = this.h + 'px';
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(this.dpr, this.dpr);
    }

    getNodePos(nn) {
        const layers = nn.layerSizes;
        const maxN = Math.max(...layers);
        const padX = 80;
        const padY = 50;
        const gapX = (this.w - padX * 2)
            / Math.max(layers.length - 1, 1);
        const gapY = (this.h - padY * 2)
            / Math.max(maxN, 2);
        const rY = Math.min(gapY * 0.35, 18);
        const rX = Math.min(gapX * 0.15, 14);
        const radius = Math.max(Math.min(rX, rY), 8);
        const positions = [];
        for (let l = 0; l < layers.length; l++) {
            const n = layers[l];
            const x = padX + l * gapX;
            const layerGap = (this.h - padY * 2) / (n + 1);
            const nodes = [];
            for (let i = 0; i < n; i++) {
                const y = padY + (i + 1) * layerGap;
                nodes.push({ x, y, radius, layer: l, idx: i });
            }
            positions.push(nodes);
        }
        return positions;
    }

    getNeuronAt(sx, sy) {
        if (!this.lastPositions) return null;
        const w = this.screenToWorld(sx, sy);
        for (const layer of this.lastPositions) {
            for (const node of layer) {
                const dx = w.x - node.x;
                const dy = w.y - node.y;
                if (dx * dx + dy * dy
                    <= (node.radius + 5) * (node.radius + 5)) {
                    return node;
                }
            }
        }
        return null;
    }

    draw(nn, options = {}) {
        const ctx = this.ctx;
        const { w, h } = this;
        const displayMode = options.displayMode || 'all';
        const edgeScale = options.edgeScale || 2.0;
        const selectedNeuron = options.selectedNeuron || null;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, w, h);

        if (!nn || !nn.layerSizes) {
            ctx.fillStyle = '#656d76';
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('네트워크를 초기화하세요', w / 2, h / 2);
            return;
        }

        const pos = this.getNodePos(nn);
        this.lastPositions = pos;
        const layers = nn.layerSizes;
        const hasForward = nn.as.length > 0;
        const hasBackward = nn.deltas.length > 0;
        const hasUpdate = nn.phase === 'updated' && nn.lastUpdate;
        const maxW = 3.0;

        ctx.setTransform(this.zoom, 0, 0, this.zoom, this.panX, this.panY);

        // ----- Edges -----
        for (let l = 0; l < pos.length - 1; l++) {
            for (let i = 0; i < pos[l].length; i++) {
                for (let j = 0; j < pos[l + 1].length; j++) {
                    const { x: x1, y: y1 } = pos[l][i];
                    const { x: x2, y: y2 } = pos[l + 1][j];
                    const wVal = nn.weights[l][j][i];
                    const absW = Math.abs(wVal);
                    const thickness = Math.max(
                        0.5, Math.min(absW * edgeScale, 6));
                    let color;

                    if (hasUpdate && displayMode === 'updates') {
                        const upd = nn.lastUpdate.weights[l][j][i];
                        const absUpd = Math.abs(upd);
                        const intensity = Math.min(absUpd * 20, 1);
                        color = upd >= 0
                            ? `rgba(26, 127, 55, ${intensity * 0.7 + 0.1})`
                            : `rgba(207, 34, 46, ${intensity * 0.7 + 0.1})`;
                    } else if (hasBackward && displayMode === 'gradients') {
                        const grad = nn.weightGradients[l][j][i];
                        const absGrad = Math.abs(grad);
                        const intensity = Math.min(absGrad * 5, 1);
                        color = `rgba(154, 103, 0, ${intensity * 0.8 + 0.1})`;
                    } else {
                        if (wVal >= 0) {
                            const intensity = 0.3 + absW / maxW * 0.5;
                            color = `rgba(9, 105, 218, ${
                                Math.min(intensity, 0.8)})`;
                        } else {
                            const intensity = 0.3 + absW / maxW * 0.5;
                            color = `rgba(207, 34, 46, ${
                                Math.min(intensity, 0.8)})`;
                        }
                    }

                    if (hasBackward
                        && (displayMode === 'all'
                            || displayMode === 'gradients')) {
                        const grad = nn.weightGradients[l][j][i];
                        const absGrad = Math.abs(grad);
                        if (absGrad > 0.001) {
                            const gradIntensity = Math.min(absGrad * 8, 1);
                            if (!color.startsWith('rgba')) {
                                color = `rgba(154, 103, 0, ${
                                    gradIntensity * 0.6 + 0.1})`;
                            }
                        }
                    }

                    const isSelectedEdge = selectedNeuron && (
                        (l === selectedNeuron.layer - 1
                            && j === selectedNeuron.idx)
                        || (l === selectedNeuron.layer
                            && i === selectedNeuron.idx)
                    );

                    if (isSelectedEdge) {
                        ctx.shadowColor = 'rgba(9,105,218,0.8)';
                        ctx.shadowBlur = 6;
                    }

                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.strokeStyle = color;
                    ctx.lineWidth = isSelectedEdge
                        ? thickness + 3 : thickness;
                    ctx.stroke();
                    ctx.shadowBlur = 0;

                    const showLabel = selectedNeuron
                        ? isSelectedEdge
                        : (layers.length - 1)
                            * Math.max(...layers)
                            * Math.max(...layers) < 60;
                    if (showLabel) {
                        const mx = (x1 + x2) / 2;
                        const my = (y1 + y2) / 2;
                        let label;
                        let labelColor = '#656d76';
                        if (isSelectedEdge) {
                            label = `가중치 ${wVal.toFixed(4)}`;
                            labelColor = '#0969da';
                        } else if (hasUpdate
                            && (displayMode === 'updates'
                                || displayMode === 'all')) {
                            const upd = nn.lastUpdate.weights[l][j][i];
                            label = `변화 ${upd.toFixed(3)}`;
                        } else if (hasBackward
                            && (displayMode === 'gradients'
                                || displayMode === 'all')) {
                            const grad = nn.weightGradients[l][j][i];
                            label = `영향 ${grad.toFixed(3)}`;
                        } else {
                            label = wVal.toFixed(2);
                        }
                        const fs = isSelectedEdge ? 11 : 9;
                        ctx.font = `${fs}px Consolas, monospace`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        const a = Math.atan2(y2 - y1, x2 - x1);
                        const off = isSelectedEdge ? 12 : 8;
                        const bw = isSelectedEdge ? 52 : 44;
                        const bh = isSelectedEdge ? 14 : 12;
                        ctx.fillStyle = 'rgba(255,255,255,0.9)';
                        ctx.fillRect(
                            mx - bw / 2,
                            my + (a > 0 ? off : -off - bh),
                            bw, bh);
                        ctx.fillStyle = isSelectedEdge
                            ? '#0969da' : labelColor;
                        ctx.font = `${fs}px Consolas, monospace`;
                        ctx.fillText(
                            label,
                            mx,
                            my + (a > 0 ? off + bh - 2 : -off));
                    }
                }
            }
        }

        // ----- Nodes -----
        for (let l = 0; l < pos.length; l++) {
            for (const node of pos[l]) {
                const { x, y, radius } = node;
                const idx = node.idx;
                let fillColor = '#e8eaed';
                let strokeColor = '#d0d7de';
                let valText = '';
                let valColor = '#656d76';

                if (l === 0 && hasForward) {
                    const v = nn.as[0][idx];
                    valText = v.toFixed(2);
                    valColor = '#0969da';
                    const intensity = Math.min(Math.abs(v) * 2, 1);
                    fillColor = `rgba(9, 105, 218, ${intensity * 0.5})`;
                    strokeColor = '#0969da';
                } else if (l > 0 && hasForward && l < nn.as.length) {
                    const v = nn.as[l][idx];
                    valText = v.toFixed(3);
                    const intensity = Math.min(Math.abs(v) * 2, 1);
                    if (v > 0.5) {
                        fillColor = `rgba(26, 127, 55, ${
                            intensity * 0.25})`;
                        strokeColor = '#1a7f37';
                        valColor = '#1a7f37';
                    } else {
                        fillColor = `rgba(9, 105, 218, ${
                            intensity * 0.3})`;
                        strokeColor = '#0969da';
                        valColor = '#0969da';
                    }
                }

                if (hasBackward && l > 0 && l - 1 < nn.deltas.length) {
                    const d = nn.deltas[l - 1][idx];
                    const absD = Math.abs(d);
                    if (absD > 0.001) {
                        const intensity = Math.min(absD * 10, 1);
                        fillColor = d > 0
                            ? `rgba(154, 103, 0, ${intensity * 0.3})`
                            : `rgba(207, 34, 46, ${intensity * 0.3})`;
                        strokeColor = d > 0 ? '#9a6700' : '#cf222e';
                    }
                }

                const isSelectedNode = selectedNeuron
                    && selectedNeuron.layer === l
                    && selectedNeuron.idx === idx;

                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fillStyle = fillColor;
                ctx.fill();
                ctx.strokeStyle = isSelectedNode
                    ? '#0969da' : strokeColor;
                ctx.lineWidth = isSelectedNode ? 3 : 1.5;
                ctx.stroke();

                if (isSelectedNode) {
                    ctx.beginPath();
                    ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(9,105,218,0.3)';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([3, 3]);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }

                ctx.font = `${Math.max(9, radius * 0.65)}px Consolas, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = valColor;
                if (l === 0 && idx === 0 && !hasForward) {
                    ctx.fillStyle = '#656d76';
                    ctx.fillText(`x${idx}`, x, y);
                } else if (valText) {
                    ctx.fillText(valText, x, y);
                } else if (l === 0) {
                    ctx.fillStyle = '#656d76';
                    ctx.fillText(`x${idx}`, x, y);
                }

                if (idx === 0) {
                    ctx.font = '10px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.fillStyle = '#8c959f';
                    const layerName = l === 0
                        ? '입력층'
                        : l === layers.length - 1
                            ? '출력층'
                            : `은닉${l}층`;
                    ctx.fillText(layerName, x, y - radius - 6);
                }

                if (l > 0) {
                    const bIdx = l - 1;
                    let bText = `b=${nn.biases[bIdx][idx].toFixed(3)}`;
                    if (hasBackward && l - 1 < nn.deltas.length) {
                        const d = nn.deltas[l - 1][idx];
                        if (d !== undefined) {
                            bText += `  ∂b=${d.toFixed(4)}`;
                        }
                    }
                    if (hasUpdate && nn.lastUpdate) {
                        const upb = nn.lastUpdate.biases[bIdx][idx];
                        if (upb !== undefined) {
                            bText += `  Δb=${upb.toFixed(4)}`;
                        }
                    }
                    ctx.font = '8px Consolas, monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';
                    ctx.fillStyle = '#656d76';
                    ctx.fillText(bText, x, y + radius + 2);
                }
            }
        }

        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // ----- Output / Target text -----
        if (hasForward && layers.length > 0) {
            const outputVals = nn.as[nn.as.length - 1];
            if (outputVals) {
                ctx.font = '11px Consolas, sans-serif';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'top';
                const ox = this.w - 12;
                const oy = 10;
                ctx.fillStyle = '#1a7f37';
                ctx.fillText(
                    `출력: [${outputVals.map(v => v.toFixed(4)).join(', ')}]`,
                    ox, oy);

                if (nn.target) {
                    ctx.fillStyle = '#cf222e';
                    ctx.fillText(
                        `목표: [${nn.target.map(v => v.toFixed(4)).join(', ')}]`,
                        ox, oy + 16);
                }
            }
        }

        // ----- Title -----
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#8c959f';
        const actName = nn.outputActivation === 'linear'
            ? '변환없음' : '시그모이드';
        ctx.fillText(
            `층: ${layers.join('→')}  은닉=시그모이드  출력=${actName}`,
            10, 10);
    }
}

export default Visualizer;
