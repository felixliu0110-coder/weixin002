Component({
  properties: {
    type: { type: String, value: "primary" },
    size: { type: String, value: "normal" },
    disabled: { type: Boolean, value: false },
    loading: { type: Boolean, value: false }
  },
  methods: {
    onTap(e) {
      if (this.data.disabled || this.data.loading) return;
      this.triggerEvent("tap", e.detail);
    }
  }
});
