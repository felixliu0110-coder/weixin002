Component({
  properties: {
    options: { type: Array, value: [] },
    value: { type: String, value: "" }
  },
  methods: {
    onTap(e) {
      const v = e.currentTarget.dataset.value;
      this.triggerEvent("change", { value: v });
    }
  }
});
