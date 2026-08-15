Component({
  properties: {
    title: { type: String, value: "" },
    desc: { type: String, value: "" },
    icon: { type: String, value: "icon-camera" },
    state: { type: String, value: "none" },
    stateText: { type: String, value: "点击上传" }
  },
  methods: {
    onTap() { this.triggerEvent("tap"); }
  }
});
