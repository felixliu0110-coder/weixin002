const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");
Page({
  data:{garments:[],filtered:[],loading:true,categories:["上衣","裤子"],activeCat:"全部"},
  onShow(){this.load();},
  load(){this.setData({loading:true});api.getMyGarments().then(list=>{const garments=(list||[]).filter(g=>g&&g.type==="upload");this.setData({garments,filtered:this.applyFilter(garments,this.data.activeCat),loading:false});}).catch(e=>{console.error("[wardrobe] load failed",e);this.setData({loading:false});toast("衣橱加载失败，请重试");});},
  applyFilter(list,cat){return cat==="全部"?list:list.filter(g=>g.category===cat);},
  onCat(e){const activeCat=e.currentTarget.dataset.cat;this.setData({activeCat,filtered:this.applyFilter(this.data.garments,activeCat)});},
  onTap(e){navigate("/pages/garment-detail/index?id="+e.currentTarget.dataset.id);},
  onAdd(){navigate("/pages/garment-add/index");},
  onTryon(e){const id=e.currentTarget.dataset.id;const g=this.data.garments.find(x=>x.id===id);if(!g)return;wx.setStorageSync("aiTryonPending",{garmentId:id,garmentIds:[id],garmentNames:[g.name],garmentImages:[g.image],garmentCategories:[g.category||"上衣"],displayName:g.name});navigate("/pages/tryon-select/index");}
});
