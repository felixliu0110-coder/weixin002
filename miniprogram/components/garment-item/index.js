Component({
  properties: {
    data: { type: Object, value: {} },
    selected: { type: Boolean, value: false }
  },
  methods: {
    onTap() {
      this.triggerEvent("tap", { id: this.data.data.id, name: this.data.data.name });
    }
  }
});
