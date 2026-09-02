Component({
  properties: { checked: { type: Boolean, value: false } },
  methods: {
    onTap() { this.triggerEvent("change", { value: !this.data.checked }); }
  }
});
