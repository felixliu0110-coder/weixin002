const { toast, navigateBack } = require("../../utils/interaction");
const api = require("../../utils/api");
Page({
 data:{name:"",category:"上衣",sizeLabel:"",lengthCm:"",chestWidthCm:"",shoulderWidthCm:"",sleeveLengthCm:"",tempPath:"",uploading:false,categories:["上衣","裤子"]},
 pickPhoto(){wx.chooseMedia({count:1,mediaType:["image"],sourceType:["album","camera"],success:r=>this.setPhoto(r)});},
 pickAlbum(){wx.chooseMedia({count:1,mediaType:["image"],sourceType:["album"],success:r=>this.setPhoto(r)});},
 pickCamera(){wx.chooseMedia({count:1,mediaType:["image"],sourceType:["camera"],success:r=>this.setPhoto(r)});},
 setPhoto(r){const f=r.tempFiles&&r.tempFiles[0];if(!f)return;if(f.size&&f.size>5*1024*1024)return toast("衣物图片不能超过5MB");wx.getImageInfo({src:f.tempFilePath,success:i=>{if(i.width<150||i.width>4096||i.height<150||i.height>4096)return toast("衣物图片尺寸需在150～4096像素之间");this.setData({tempPath:f.tempFilePath});},fail:()=>toast("无法读取衣物图片")});},
 onName(e){this.setData({name:e.detail.value});},onCategory(e){this.setData({category:e.currentTarget.dataset.cat});},onSize(e){this.setData({sizeLabel:e.detail.value});},onInput(e){this.setData({[e.currentTarget.dataset.field]:e.detail.value});},
 submit(){const d=this.data;if(d.uploading)return;if(!d.name.trim())return toast("请先给衣物取个名字");if(!d.tempPath)return toast("请先添加衣物照片");this.setData({uploading:true});wx.showLoading({title:"保存中",mask:true});
 wx.cloud.uploadFile({cloudPath:"garments/"+Date.now()+"-"+Math.random().toString(36).slice(2,8)+".jpg",filePath:d.tempPath}).then(up=>api.uploadGarment(up.fileID,{name:d.name.trim(),category:d.category})).then(g=>{if(!g)throw new Error("上传失败");if(g.pass===false)throw new Error(g.reason||"图片内容不符合要求");const m={};["lengthCm","chestWidthCm","shoulderWidthCm","sleeveLengthCm"].forEach(k=>{const v=(d[k]||"").trim();if(v)m[k]=parseFloat(v);});const meas=Object.keys(m).length?m:null;return (meas||d.sizeLabel.trim())?api.updateGarment(g.id,{size_label:d.sizeLabel.trim()||null,measurements:meas}).then(()=>g):g;}).then(g=>{wx.hideLoading();this.setData({uploading:false});toast("已保存到我的衣橱");setTimeout(()=>navigateBack(),500);}).catch(e=>{wx.hideLoading();this.setData({uploading:false});console.error("[garment-add] failed",e);toast((e&&e.message)||"保存失败，请重试",2600);});}
});
