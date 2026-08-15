Component({
  properties: {
    data: { type: Object, value: {} }
  },
  methods: {
    onTap() {
      this.triggerEvent("tap", { id: this.data.data.id });
    }
  }
});
