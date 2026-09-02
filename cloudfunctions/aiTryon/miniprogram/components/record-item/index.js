Component({
  properties: {
    data: { type: Object, value: {} },
    selected: { type: Boolean, value: false }
  },
  methods: {
    onTap() {
      this.triggerEvent("tap", { id: this.data.data.id });
    },
    onLongPress() {
      this.triggerEvent("longpress", { id: this.data.data.id });
    }
  }
});
