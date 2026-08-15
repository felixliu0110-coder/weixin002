Component({
  properties: {
    percent: { type: Number, value: 0 }
  },
  observers: {
    percent(v) { this.setData({ percent: Math.max(0, Math.min(100, v)) }); }
  }
});
