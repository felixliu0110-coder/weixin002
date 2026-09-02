Component({
  properties: {
    label: { type: String, value: "" },
    selected: { type: Boolean, value: false },
    group: { type: String, value: "" }
  },
  methods: {
    onTap() {
      this.triggerEvent("change", { label: this.data.label, group: this.data.group });
    }
  }
});
