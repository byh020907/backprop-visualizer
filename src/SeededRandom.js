class SeededRandom {
    constructor(seed = 42) {
        this.seed = seed;
    }

    next() {
        this.seed = (this.seed * 1664525 + 1013904223) & 0xffffffff;
        return (this.seed >>> 0) / 0xffffffff;
    }

    randn() {
        const u1 = this.next();
        const u2 = this.next();
        return Math.sqrt(-2 * Math.log(u1 + 1e-10))
             * Math.cos(2 * Math.PI * u2);
    }
}

export default SeededRandom;
