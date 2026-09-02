Component({
  properties: { visible: { type: Boolean, value: false } },
  methods: {
    noop() {},
    onMaskTap() { this.triggerEvent("cancel"); },
    onConfirm() { this.triggerEvent("confirm"); },
    onCancel() { this.triggerEvent("cancel"); }
  }
});
