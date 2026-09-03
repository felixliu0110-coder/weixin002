Component({
  properties: {
    data: { type: Object, value: {} },
    selected: { type: Boolean, value: false },
    editable: { type: Boolean, value: false }
  },
  methods: {
    onTap() {
      this.triggerEvent("tap", { id: this.data.data.id, name: this.data.data.name });
    },
    onLongPress() {
      this.triggerEvent("longpress", { id: this.data.data.id, name: this.data.data.name });
    },
    onEdit() {
      this.triggerEvent("edit", { id: this.data.data.id, name: this.data.data.name, sizeLabel: this.data.data.size_label, measurements: this.data.data.measurements || {}, category: this.data.data.category || "上衣" });
    }
  }
});