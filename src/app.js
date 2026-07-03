import Visualizer from './Visualizer.js';
import appStore from './ui.js';

const canvas = document.getElementById('netCanvas');
const viz = new Visualizer(canvas);

Alpine.data('app', () => appStore({ viz }));

const el = document.body;
el.setAttribute('x-data', 'app');
Alpine.initTree(el);

// Keyboard shortcuts (outside Alpine — global)
document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT'
        || e.target.tagName === 'SELECT') return;
    const el = document.querySelector('[x-data]');
    if (!el) return;
    const data = Alpine.$data(el);
    switch (e.key) {
        case 'i': case 'I': data.initNetwork(); break;
        case 'f': case 'F': data.doForward(); break;
        case 'b': case 'B': data.doBackward(); break;
        case 'u': case 'U': data.doUpdate(); break;
        case 's': case 'S': data.doStep(); break;
        case 'r': case 'R': data.resetNetwork(); break;
        case ' ': e.preventDefault(); data.toggleAuto(); break;
        case 'Escape': data.hideDetail(); break;
    }
});
