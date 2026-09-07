
---\n\n## 公共组件\n\n### btn 组件\n`\Component({
  properties: {
    type: { type: String, value: "primary" },
    size: { type: String, value: "normal" },
    disabled: { type: Boolean, value: false },
    loading: { type: Boolean, value: false },
    openType: { type: String, value: "" }
  },
  methods: {
    onTap(e) {
      if (this.data.disabled || this.data.loading) return;
      this.triggerEvent("tap", e.detail);
    }
  }
});

\\\\n\n###nav-bar 组件\n`\<view class="nav" style="padding-top: {{statusBarHeight}}px;">
  <view class="nav-bar" style="height: {{navHeight}}px;">
    <view class="nav-left">
      <view wx:if="{{showBack}}" class="nav-btn" hover-class="nav-btn-hover" catchtap="onBack">
        <image class="ic-img" style="width:42rpx;height:42rpx" src="/assets/icons/png/icon-back-dark.png" />
      </view>
    </view>
    <view wx:if="{{brand}}" class="nav-brand">{{brand}}</view>
    <view wx:else class="nav-title">{{title}}</view>
    <view class="nav-right"><slot name="right"></slot></view>
  </view>
</view>

\\\\n`\.nav { width: 100%; background: var(--bg); }
.nav-bar { display: flex; align-items: center; padding: 0 16rpx; position: relative; }
.nav-left { width: 96rpx; display: flex; align-items: center; }
.nav-brand { font-size: 38rpx; font-weight: 700; letter-spacing: 0.05em; padding: 0 16rpx; color: var(--fg); }
.nav-brand .accent { color: var(--accent-deep); }
.nav-title { position: absolute; left: 168rpx; right: 168rpx; text-align: center; font-size: 32rpx; font-weight: 600; color: var(--fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nav-right { margin-left: auto; display: flex; gap: 4rpx; }
.nav-btn { width: 80rpx; height: 80rpx; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); color: var(--fg); transition: background 0.15s ease; }
.nav-btn-hover { background: var(--surface-2); }
.nav-btn .iconfont { font-size: 42rpx; }
/* V22 */
.nav{background:var(--bg)}.nav-bar{padding:0 20rpx}.nav-left{width:84rpx}.nav-title{left:104rpx;right:104rpx;font-size:31rpx;font-weight:650}.nav-btn{width:64rpx;height:64rpx;border-radius:16rpx}.nav-btn-hover{background:var(--surface-2)}.nav-right{gap:2rpx}

\\\\n\n### tabbar 组件\n`\<view class="tabbar">
  <view
    wx:for="{{list}}"
    wx:key="pagePath"
    class="tab {{selected === index ? 'on' : ''}}"
    hover-class="tab-hover"
    data-index="{{index}}"
    catchtap="onSelect"
  >
    <view class="tab-ic ic-{{item.type}}"></view>
    <text class="tab-label">{{item.text}}</text>
  </view>
</view>

\\\\n`\/* ===== TabBar 统一视觉（SVG 矢量图标，lucide 线条风格）===== */
.tabbar {
  display: flex;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(20rpx);
  -webkit-backdrop-filter: blur(20rpx);
  border-top: 1rpx solid var(--border-soft);
  padding: 10rpx 24rpx calc(10rpx + env(safe-area-inset-bottom));
  min-height: calc(var(--tabbar-h) + env(safe-area-inset-bottom));
  position: relative;
  z-index: 60;
  box-shadow: 0 -2rpx 12rpx rgba(70, 52, 40, 0.04);
}

.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  padding: 6rpx 0;
  transition: all 0.2s var(--ease);
}

/* 图标：SVG data URI，48rpx 视觉尺寸，矢量渲染任意 DPR 不发虚 */
.tab-ic {
  width: 48rpx;
  height: 48rpx;
  background-size: 100% 100%;
  background-repeat: no-repeat;
  background-position: center;
  transition: transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* 文字：不加 letter-spacing（会让居中文本重心偏移）*/
.tab-label {
  font-size: 21rpx;
  color: var(--muted);
  line-height: 1.2;
  transition: color 0.25s ease;
}

/* ===== 选中态：图标换色 + 微弹上浮，文字变色加粗 ===== */
.tab.on .tab-ic {
  transform: translateY(-2rpx) scale(1.08);
}
.tab.on .tab-label {
  color: var(--accent-text);
  font-weight: 600;
}
/* V22 */
.tabbar{padding:8rpx 28rpx calc(8rpx + env(safe-area-inset-bottom));background:rgba(255,255,255,.94);border-top:1rpx solid var(--border-soft);box-shadow:0 -4rpx 18rpx rgba(58,43,34,.045)}.tab{gap:4rpx;padding:5rpx 0}.tab-ic{width:44rpx;height:44rpx}.tab-label{font-size:20rpx}.tab.on .tab-ic{transform:translateY(-1rpx) scale(1.04)}

\\\\n\n### garment-item 组件\n`\<view class="garment {{selected ? 'on' : ''}}" hover-class="garment-hover" catchtap="onTap" catchlongpress="onLongPress">
  <view class="g-img"><image class="g-img-image" src="{{data.image}}" mode="aspectFill" /></view>
  <view class="pick"><image class="pick-img" src="/assets/icons/png/icon-check-white.png" mode="aspectFit" /></view>
  <view class="g-edit" wx:if="{{editable}}" catchtap="onEdit" hover-class="g-edit-hover">
    <image class="g-edit-icon" src="/assets/icons/png/icon-settings-dark.png" mode="aspectFit" />
  </view>
  <view class="g-name">{{data.name}}</view>
  <view class="g-cat">{{data.category}}{{data.size_label ? ' · ' + data.size_label : ''}}</view>
</view>
\\\\n`\.garment { position: relative; border: 2rpx solid var(--border-soft); background: var(--surface); border-radius: var(--radius-md); padding: 16rpx 14rpx 16rpx; text-align: center; transition: all 0.2s var(--ease); }
.garment-hover { transform: scale(0.97); box-shadow: var(--shadow-card-hover); }
.garment.on { border-color: var(--accent); box-shadow: 0 0 0 4rpx var(--accent-soft); }
.g-img { width: 100%; height: 280rpx; border-radius: var(--radius-sm); overflow: hidden; background: var(--surface-2); }
.g-img-image { width: 100%; height: 100%; }
.g-name { font-size: 25rpx; font-weight: 500; margin-top: 14rpx; color: var(--fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.g-cat { font-size: 22rpx; color: var(--muted); margin-top: 4rpx; }
.pick { position: absolute; top: 24rpx; right: 22rpx; width: 44rpx; height: 44rpx; border-radius: 50%; border: 2rpx solid var(--border); background: var(--surface); display: flex; align-items: center; justify-content: center; opacity: 0; transform: scale(0.7); transition: all 0.2s var(--ease-bounce); }
.pick-img { width: 26rpx; height: 26rpx; opacity: 0; }
.garment.on .pick { opacity: 1; transform: scale(1); background: var(--accent); border-color: var(--accent); }
.garment.on .pick-img { opacity: 1; }

.g-edit {
  position: absolute;
  top: 14rpx;
  left: 14rpx;
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
  border: 1rpx solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  transition: all 0.2s var(--ease);
}
.g-edit-hover {
  opacity: 0.75;
}
.g-edit-icon {
  width: 28rpx;
  height: 28rpx;
}
\\\\n\n
---\n\n## 页面: login\n\n### login/index.js\n`\const { toast, navigate } = require("../../utils/interaction");

Page({
  data: { agreed: false },
  toggleAgree() {
    const agreed = !this.data.agreed;
    this.setData({ agreed });
    toast(agreed ? "已同意《用户协议》和《隐私政策》" : "需同意协议后才能使用人脸相关功能");
  },
  onLogin() {
    // 隐私合规：协议需用户主动勾选同意，未勾选不允许进入
    if (!this.data.agreed) {
      toast("请先阅读并同意《用户协议》和《隐私政策》");
      return;
    }
    // 真实微信登录：云函数获取微信身份（openid），存本地后进入
    const app = getApp();
    const enter = async () => {
      if (app && app.globalData) app.globalData.loggedIn = true;
      try {
        const profileRes = await wx.cloud.callFunction({ name: "auth", data: { action: "profileGet" } });
        const r = profileRes && profileRes.result || {};
        if (!r.ok) throw new Error(r.message || "人物档案读取失败");
        navigate(r.empty ? "/pages/basic-info/index" : "/pages/home/index");
      } catch (e) {
        console.error("[login] profile bootstrap failed", e);
        toast((e && e.message) || "读取人物档案失败，请重试");
      }
    };
    if (wx.cloud && wx.cloud.callFunction) {
      wx.cloud.callFunction({ name: "auth", data: { action: "login" } })
        .then((res) => {
          const r = res && res.result || {};
          if (!r.ok || !r.loggedIn || !r.openid) {
            const err = new Error(r.message || "微信身份校验失败");
            err.cloudResult = r;
            throw err;
          }
          wx.setStorageSync("userOpenid", r.openid);
          if (app && app.globalData) app.globalData.openid = r.openid;
          return enter();
        })
        .catch((e) => {
          console.error("[login] auth failed", e);
          toast((e && e.message) || "登录失败，请稍后重试");
        });
    } else {
      console.error("[login] wx.cloud unavailable");
      toast("云服务未就绪，请检查小程序云开发配置");
    }
  }
});

\\\\n\n### login/index.wxml\n`\<view class="wx-page">
  <view class="content big-hero-center">
    <view class="login-title">我形<text class="accent-word">我衣</text></view>
    <view class="login-tag">看见每一件衣服穿在自己身上的样子</view>
    <view class="hero-art">
      <image src="/assets/img/p01-hero.jpg" mode="widthFix" />
    </view>
    <view class="check-row {{agreed ? 'on' : ''}}" hover-class="check-hover" bindtap="toggleAgree">
      <view class="box"><image class="ic-img" style="width:26rpx;height:26rpx" src="/assets/icons/png/icon-check-white.png" /></view>
      <view class="check-copy">我已阅读并同意<text class="strong">《用户协议》</text>和<text class="strong">《隐私政策》</text></view>
    </view>
    <btn class="login-cta" type="primary" bindtap="onLogin"><image class="btn-icon btn-icon-white" src="/assets/icons/png/icon-user-gray.png" />微信授权登录</btn>
  </view>
</view>

\\\\n\n### login/index.wxss\n`\.wx-page { height: 100vh; display: flex; flex-direction: column; background: var(--bg); overflow: hidden; }
.content { flex: 1; padding: 4px 24rpx 24px; overflow-y: auto; }
.big-hero-center { display: flex; flex-direction: column; justify-content: center; padding-bottom: 16rpx; }
.login-title { font-size: 68rpx; font-weight: 700; letter-spacing: 0.12em; text-align: center; margin-top: 72rpx; color: var(--fg); }
.accent-word { color: var(--accent-deep); font-weight: 700; }
.login-tag { text-align: center; font-size: 29rpx; color: var(--fg-2); margin-top: 20rpx; letter-spacing: 0.02em; }
.hero-art { margin-top: 52rpx; border-radius: var(--radius-xl); overflow: hidden; border: 1rpx solid var(--border-soft); box-shadow: var(--shadow-raise); background: var(--surface); }
.hero-art image { width: 100%; }
.check-row { display: flex; align-items: flex-start; gap: 18rpx; width: 100%; padding: 40rpx 24rpx 0; }
.box { flex: 0 0 42rpx; width: 42rpx; height: 42rpx; border-radius: 14rpx; border: 2rpx solid var(--border); background: var(--surface); display: flex; align-items: center; justify-content: center; margin-top: 2rpx; transition: all 0.2s var(--ease); }
.box .iconfont { font-size: 26rpx; color: transparent; }
.check-row.on .box { background: var(--accent); border-color: var(--accent); box-shadow: 0 2rpx 8rpx rgba(227, 165, 149, 0.30); }
.check-row.on .box .iconfont { color: var(--accent-on); }
.check-copy { font-size: 26rpx; color: var(--fg-2); line-height: 1.7; }
.strong { color: var(--fg); font-weight: 500; }
.check-hover { opacity: 0.85; }
.login-cta { display: block; margin-top: 48rpx; width: 100%; }

\\\\n\n### login/index.json\n`\{
  "usingComponents": {
    "btn": "/components/btn/index",
    "sheet": "/components/sheet/index",
    "tab-bar": "/components/tabbar/index"
  },
  "navigationBarTitleText": "登录"
}

\\\\n\n
---\n\n## 页面: home\n\n### home/index.js\n`\const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

function resolveImage(src) {
  if (!src || src.indexOf("cloud://") !== 0 || !wx.cloud || !wx.cloud.getTempFileURL) return Promise.resolve(src || "");
  return new Promise((resolve) => wx.cloud.getTempFileURL({ fileList: [src], success: r => resolve((r.fileList && r.fileList[0] && r.fileList[0].tempFileURL) || src), fail: () => resolve(src) }));
}

Page({
  data: { statusBarHeight: 20, keyword: "", garments: [], filteredGarments: [], quota: { dailyFree: 3, used: 0, remaining: 3 }, avatarReady: false, personImage: "" },
  async onLoad() {
    try { const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync(); this.setData({ statusBarHeight: info.statusBarHeight || 20 }); } catch (e) {}
    this.loadData();
  },
  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) this.getTabBar().setData({ selected: 0, navMode: false, pill: false });
    if (this.data.garments.length || this.data.avatarReady) this.loadData();
  },
  async loadData() {
    try {
      const [garments, quota, profile] = await Promise.all([api.getMyGarments(), api.getQuota(), api.getAvatarProfile()]);
      const list = (garments || []).filter(g => g && g.type === "upload");
      const remaining = Math.max(0, (quota.dailyFree || 0) - (quota.used || 0));
      let avatarReady = false, personImage = "";
      if (profile && profile.id) {
        const asset = await api.getPersonAsset(profile.id);
        const original = asset && (asset.original_photo || asset.originalPhoto || "");
        avatarReady = !!original;
        personImage = await resolveImage(original);
      }
      this.setData({ garments: list, filteredGarments: this.filter(list, this.data.keyword), quota: Object.assign({}, quota, { used: quota.used || 0, remaining }), avatarReady, personImage });
    } catch (e) { console.error("[home] loadData failed", e); }
  },
  filter(list, keyword) { const k = (keyword || "").trim().toLowerCase(); return k ? list.filter(g => (g.name || "").toLowerCase().indexOf(k) >= 0) : list.slice(0, 6); },
  onSearchInput(e) { const keyword = e.detail.value; this.setData({ keyword, filteredGarments: this.filter(this.data.garments, keyword) }); },
  onSearch() { if (!this.data.keyword.trim()) toast("请输入衣物名称"); },
  onMore() { navigate("/pages/wardrobe/index"); },
  goTryon() { navigate(this.data.avatarReady ? "/pages/tryon-select/index" : "/pages/avatar-3d/index"); },
  goAvatar() { navigate("/pages/avatar-3d/index"); },
  openGarment(e) { navigate("/pages/garment-detail/index?id=" + e.currentTarget.dataset.id); }
});

\\\\n\n### home/index.wxml\n`\<view class="wx-page">
  <view class="home-nav" style="padding-top: {{statusBarHeight}}px;"><text class="brand">我形<text class="accent">我衣</text></text></view>
  <view class="content">
    <view class="search-box"><image class="ic-img" style="width:32rpx;height:32rpx" src="/assets/icons/png/icon-search-gray.png" /><input class="search-input" placeholder="搜索我的衣物" confirm-type="search" value="{{keyword}}" bindinput="onSearchInput" bindconfirm="onSearch" /></view>
    <view class="hero-tryon" hover-class="hero-hover" bindtap="goTryon">
      <view class="ht-copy"><view class="ht-title">{{avatarReady ? '从一件衣服开始' : '先建立你的穿衣基准'}}</view><view class="ht-sub">{{avatarReady ? '看看它穿在你的身形上，会是什么样子' : '添加真实人物照片后，就可以开始试穿'}}</view></view>
      <view class="ht-ic"><image class="ic-img" style="width:44rpx;height:44rpx" src="/assets/icons/png/icon-hanger-white.png" /></view>
    </view>
    <view class="quota-row"><image class="ic-img" style="width:28rpx;height:28rpx" src="/assets/icons/png/icon-star-deep.png" />今日剩余 <text class="mono">{{quota.remaining}}</text> 次免费试穿</view>
    <view class="sec-hd"><text class="sec-title">我的衣物</text><view class="more" hover-class="more-hover" bindtap="onMore">查看全部<image class="ic-img" style="width:26rpx;height:26rpx" src="/assets/icons/png/icon-chevron-right-gray.png" /></view></view>
    <view wx:if="{{filteredGarments.length}}" class="template-grid">
      <view class="template" wx:for="{{filteredGarments}}" wx:key="id" data-id="{{item.id}}" bindtap="openGarment"><view class="t-img"><image src="{{item.image}}" mode="aspectFill" /></view><view class="t-name">{{item.name}}</view></view>
    </view>
    <view wx:else class="home-empty"><image class="empty-img" src="/assets/icons/png/icon-hanger-gray.png" /><text>{{keyword ? '没有找到匹配的衣物' : '还没有衣物'}}</text><view class="more" bindtap="onMore">去衣橱添加</view></view>
    <view class="sec-hd sec-avatar"><text class="sec-title">我的人物</text><text class="hint">{{avatarReady ? '已建立' : '未建立'}}</text></view>
    <view class="avatar-row" hover-class="avatar-hover" bindtap="goAvatar">
      <view class="ar-img"><image wx:if="{{personImage}}" src="{{personImage}}" mode="aspectFill" /><view wx:else class="ar-placeholder"><image src="/assets/icons/png/icon-avatar-gray.png" /></view></view>
      <view class="ar-copy"><view class="ar-name">我的人物</view><view class="ar-sub">{{avatarReady ? '真实人物照片已就绪，可用于试穿' : '添加真实人物照片，建立你的穿衣基准'}}</view></view><view class="ar-btn">{{avatarReady ? '查看' : '建立'}}</view>
    </view>
  </view>
</view>

\\\\n\n### home/index.wxss\n`\.wx-page { height: 100vh; display: flex; flex-direction: column; background: var(--bg); overflow: hidden; padding-bottom: calc(var(--tabbar-h) + env(safe-area-inset-bottom)); }
.home-nav { height: 88rpx; display: flex; align-items: center; padding: 0 28rpx; }
.brand { font-size: 40rpx; font-weight: 700; letter-spacing: 0.06em; padding: 0 16rpx; color: var(--fg); }
.brand .accent { color: var(--accent-deep); font-weight: 700; }
.search-box { display: flex; align-items: center; gap: 16rpx; height: 84rpx; padding: 0 32rpx; border-radius: 999rpx; background: var(--surface); border: 1rpx solid var(--border-soft); color: var(--muted); margin: 20rpx 0 28rpx; box-shadow: var(--shadow-card); }
.search-box .iconfont { font-size: 32rpx; flex: 0 0 auto; }
.search-input { flex: 1; min-width: 0; border: 0; background: transparent; font-size: 28rpx; color: var(--fg); }
.hero-tryon { display: flex; align-items: center; gap: 28rpx; border-radius: var(--radius-lg); background: linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%); color: var(--accent-on); padding: 40rpx 44rpx; width: 100%; box-shadow: 0 12rpx 36rpx rgba(227, 165, 149, 0.30); transition: all 0.2s var(--ease); }
.hero-hover { filter: brightness(1.04); transform: scale(0.985); box-shadow: 0 8rpx 24rpx rgba(227, 165, 149, 0.25); }
.ht-copy { flex: 1; min-width: 0; }
.ht-title { font-size: 38rpx; font-weight: 700; letter-spacing: 0.02em; }
.ht-sub { font-size: 27rpx; opacity: 0.90; margin-top: 10rpx; line-height: 1.55; }
.ht-ic { flex: 0 0 96rpx; width: 96rpx; height: 96rpx; border-radius: var(--radius-md); background: rgba(255,255,255,0.20); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(8rpx); }
.ht-ic .iconfont { font-size: 44rpx; }
.quota-row { display: flex; align-items: center; gap: 12rpx; padding: 20rpx 28rpx; background: var(--surface); border: 1rpx solid var(--border-soft); border-radius: var(--radius-md); color: var(--fg-2); font-size: 27rpx; font-weight: 500; margin-top: 24rpx; box-shadow: var(--shadow-card); }
.quota-row .iconfont { font-size: 30rpx; }
.sec-hd { display: flex; align-items: baseline; justify-content: space-between; margin: 48rpx 0 28rpx; }
.sec-avatar { margin-top: 48rpx; }
.sec-title { font-size: 34rpx; font-weight: 600; color: var(--fg); }
.hint { font-size: 26rpx; color: var(--fg-2); }
.more { display: flex; align-items: center; gap: 4rpx; font-size: 28rpx; color: var(--accent-text); padding: 8rpx 4rpx; font-weight: 500; }
.more .iconfont { font-size: 26rpx; }
.more-hover { opacity: 0.75; }
.template-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24rpx; }
.template { text-align: center; }
.template-hover .t-img { transform: scale(0.97); box-shadow: var(--shadow-card-hover); }
.t-img { border-radius: var(--radius-md); overflow: hidden; border: 1rpx solid var(--border-soft); background: var(--surface); box-shadow: var(--shadow-card); transition: all 0.2s var(--ease); }
.t-img image { width: 100%; height: 280rpx; }
.t-name { font-size: 27rpx; color: var(--fg); margin-top: 16rpx; font-weight: 500; }
.avatar-row { display: flex; align-items: center; gap: 28rpx; padding: 32rpx 36rpx; background: var(--surface); border: 1rpx solid var(--border-soft); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); width: 100%; transition: all 0.2s var(--ease); }
.avatar-hover { box-shadow: var(--shadow-card-hover); }
.ar-img { flex: 0 0 160rpx; width: 160rpx; height: 160rpx; border-radius: var(--radius-md); overflow: hidden; border: 1rpx solid var(--border-soft); }
.ar-img image { width: 100%; height: 100%; }
.ar-copy { flex: 1; min-width: 0; }
.ar-name { font-size: 32rpx; font-weight: 600; }
.ar-sub { font-size: 27rpx; color: var(--fg-2); margin-top: 10rpx; line-height: 1.55; }
.ar-btn { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; min-height: 64rpx; padding: 0 32rpx; border-radius: 999rpx; background: var(--accent-soft); color: var(--accent-text); font-size: 28rpx; font-weight: 600; transition: all 0.15s var(--ease); }
.ar-btn:active { background: var(--accent); color: var(--accent-on); }
.home-empty { min-height: 180rpx; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:18rpx; color:var(--muted); font-size:27rpx; background:var(--surface); border:1rpx solid var(--border-soft); border-radius:var(--radius-lg); }
.ar-placeholder { width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:var(--surface-2); color:var(--muted); font-size:44rpx; }
/* V22 */
.home-nav{height:92rpx;align-items:flex-end;padding-bottom:16rpx}.brand{font-size:36rpx;padding:0;font-weight:700}.search-box{height:76rpx;margin:8rpx 0 20rpx;padding:0 24rpx;border-radius:20rpx;box-shadow:none;background:var(--surface);}.hero-tryon{padding:30rpx 28rpx;border-radius:26rpx;gap:20rpx}.ht-title{font-size:34rpx}.ht-sub{font-size:25rpx}.ht-ic{width:76rpx;height:76rpx;flex-basis:76rpx;border-radius:20rpx}.quota-row{margin-top:14rpx;padding:16rpx 20rpx;border-radius:18rpx;box-shadow:none;font-size:24rpx}.sec-hd{margin-top:32rpx}.template-grid{gap:18rpx}.t-img{border-radius:20rpx;box-shadow:none}.t-img image{height:250rpx}.t-name{margin-top:10rpx;font-size:26rpx}.avatar-row{padding:20rpx;border-radius:22rpx;box-shadow:none;gap:18rpx}.ar-img{width:112rpx;height:112rpx;flex-basis:112rpx;border-radius:18rpx}.ar-name{font-size:29rpx}.ar-sub{font-size:24rpx}.ar-btn{min-width:92rpx;min-height:58rpx;padding:0 20rpx;font-size:25rpx}
.empty-img{width:46rpx;height:46rpx;opacity:.6;margin-bottom:2rpx}.ar-placeholder image{width:48rpx;height:48rpx;opacity:.55}

\\\\n\n### home/index.json\n`\{
  "usingComponents": { "nav-bar": "/components/nav-bar/index" },
  "navigationBarTitleText": "我形我衣"
}

\\\\n\n
---\n\n## 页面: wardrobe\n\n### wardrobe/index.js\n`\const { toast, navigate } = require("../../utils/interaction");
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

\\\\n\n### wardrobe/index.wxml\n`\<view class="wx-page">
  <nav-bar title="我的衣橱"></nav-bar>
  <view class="content">
    <view class="wardrobe-head"><view><text class="wardrobe-title">我的衣物</text><text class="wardrobe-sub">{{garments.length}} 件 · 点击查看，长按删除</text></view><view class="add-link" bindtap="onAdd"><image src="/assets/icons/png/icon-plus-gray.png" />添加</view></view>
    <view class="cat-tabs"><view class="cat-tab {{activeCat==='全部'?'on':''}}" data-cat="全部" bindtap="onCat">全部</view><view wx:for="{{categories}}" wx:key="*this" class="cat-tab {{activeCat===item?'on':''}}" data-cat="{{item}}" bindtap="onCat">{{item}}</view></view>
    <view wx:if="{{loading}}" class="state">正在加载衣物…</view>
    <view wx:elif="{{filtered.length===0}}" class="empty-state"><view class="empty-icon"><image src="/assets/icons/png/icon-hanger-gray.png" /></view><text>{{activeCat==='全部' ? '衣橱还是空的' : '这个分类还没有衣物'}}</text><text class="empty-sub">添加衣物后，它会一直保存在这里，不会自动开始试穿。</text><btn type="primary" size="sm" bindtap="onAdd"><image class="btn-icon btn-icon-white" src="/assets/icons/png/icon-plus-gray.png" />添加衣物</btn></view>
    <view wx:else class="grid"><view wx:for="{{filtered}}" wx:key="id" class="item" data-id="{{item.id}}" bindtap="onTap" bindlongpress="onTryon"><view class="item-img"><image src="{{item.image}}" mode="aspectFill" /></view><text class="name">{{item.name}}</text><text class="meta">{{item.category}}<text wx:if="{{item.size_label}}"> · {{item.size_label}}</text></text></view></view>
    <view wx:if="{{filtered.length && activeCat==='全部'}}" class="wardrobe-tip">长按衣物可快速进入试穿选择；也可以先进入详情查看信息。</view>
  </view>
</view>

\\\\n\n### wardrobe/index.wxss\n`\.wx-page{height:100vh;display:flex;flex-direction:column;background:var(--bg);overflow:hidden;padding-bottom:calc(var(--tabbar-h) + env(safe-area-inset-bottom));}
.content{flex:1;min-height:0;overflow-y:auto;padding:8rpx 24rpx 48rpx;}
.wardrobe-head{display:flex;align-items:center;justify-content:space-between;padding:28rpx 4rpx 18rpx}.wardrobe-title{display:block;font-size:38rpx;font-weight:700}.wardrobe-sub{display:block;margin-top:8rpx;color:var(--muted);font-size:25rpx}.add-link{padding:14rpx 22rpx;border-radius:999rpx;background:var(--accent-soft);color:var(--accent-text);font-weight:600;font-size:28rpx}.cat-tabs{display:flex;gap:12rpx;margin:18rpx 0 28rpx}.cat-tab{padding:12rpx 26rpx;border-radius:999rpx;background:var(--surface);border:1rpx solid var(--border);color:var(--fg-2);font-size:27rpx}.cat-tab.on{background:var(--fg);border-color:var(--fg);color:#fff;font-weight:600}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:30rpx 20rpx}.item{min-width:0}.item-img{height:400rpx;border-radius:var(--radius-md);overflow:hidden;background:var(--surface);border:1rpx solid var(--border-soft);box-shadow:var(--shadow-card)}.item-img image{width:100%;height:100%}.name{display:block;margin-top:14rpx;font-size:29rpx;font-weight:600}.meta{display:block;margin-top:6rpx;font-size:24rpx;color:var(--muted)}.state,.empty-state{padding:120rpx 30rpx;text-align:center;color:var(--muted)}.empty-state{display:flex;flex-direction:column;align-items:center;gap:16rpx;background:var(--surface);border:1rpx solid var(--border-soft);border-radius:var(--radius-lg);margin-top:20rpx}.empty-icon{width:88rpx;height:88rpx;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--accent-soft);color:var(--accent-text);font-size:36rpx;font-weight:700}.empty-sub{font-size:25rpx;line-height:1.6;max-width:560rpx}.wardrobe-tip{text-align:center;color:var(--muted);font-size:24rpx;padding:34rpx 20rpx}
/* V22 */
.content{padding-top:0}.wardrobe-head{padding:22rpx 0 14rpx}.wardrobe-title{font-size:34rpx}.wardrobe-sub{font-size:23rpx}.add-link{display:flex;align-items:center;gap:4rpx;padding:11rpx 16rpx;border-radius:16rpx;font-size:25rpx}.cat-tabs{overflow-x:auto;gap:10rpx;margin:10rpx 0 22rpx;white-space:nowrap}.cat-tab{flex:0 0 auto;padding:10rpx 20rpx;border-radius:14rpx;font-size:25rpx}.grid{gap:26rpx 18rpx}.item-img{height:360rpx;border-radius:20rpx;box-shadow:none}.name{margin-top:10rpx;font-size:27rpx}.meta{font-size:23rpx}.empty-state{padding:84rpx 24rpx}.wardrobe-tip{font-size:22rpx}
.add-link image{width:24rpx;height:24rpx;opacity:.75}.empty-icon image{width:40rpx;height:40rpx;opacity:.7}

\\\\n\n### wardrobe/index.json\n`\{"navigationBarTitleText": "我的衣橱"}
\\\\n\n
---\n\n## 页面: tryon-select\n\n### tryon-select/index.js\n`\const { toast, navigate, requestSubscribe } = require("../../utils/interaction");
const api = require("../../utils/api");
Page({data:{garments:[],categories:["上衣","裤子"],selectedId:"",selectedName:"",personReady:false,checkingPerson:true,uploadVisible:false,infoVisible:false,uploadName:"",uploadCategory:"上衣",uploading:false},onLoad(){this.load();this.checkPerson();},onShow(){if(this.getTabBar&&this.getTabBar())this.getTabBar().setData({selected:1,navMode:false,pill:false});this.load();},async checkPerson(){this.setData({checkingPerson:true});try{const p=await api.getAvatarProfile();if(!p||!p.id)throw new Error();const a=await api.getPersonAsset(p.id);this.setData({personReady:!!(a&&a.original_photo),checkingPerson:false});}catch(e){this.setData({personReady:false,checkingPerson:false});}},load(){const pending=wx.getStorageSync("aiTryonPending")||{};const pendingId=pending.garmentId||(pending.garmentIds&&pending.garmentIds[0])||"";const selectedId=this.data.selectedId||pendingId;api.getMyGarments().then(list=>{const garments=(list||[]).filter(g=>g&&g.type==="upload").map(g=>Object.assign({},g,{selected:g.id===selectedId}));const chosen=garments.find(g=>g.id===selectedId);this.setData({garments,selectedId:chosen?selectedId:"",selectedName:chosen?chosen.name:""});}).catch(()=>this.setData({garments:[]}));},goPerson(){navigate("/pages/avatar-3d/index");},selectGarment(e){const id=e.currentTarget.dataset.id;const g=this.data.garments.find(x=>x.id===id);if(!g)return;this.setData({selectedId:this.data.selectedId===id?"":id,selectedName:this.data.selectedId===id?"":g.name,garments:this.data.garments.map(x=>Object.assign({},x,{selected:x.id===id?this.data.selectedId!==id:false}))});},startTryon(){if(!this.data.personReady)return toast("请先建立人物基准");if(!this.data.selectedId)return toast("请先选择一件衣物");if(this._starting)return;this._starting=true;const g=this.data.garments.find(x=>x.id===this.data.selectedId);requestSubscribe().then(()=>{wx.setStorageSync("aiTryonPending",{garmentId:g.id,garmentIds:[g.id],garmentNames:[g.name],garmentImages:[g.image||""],garmentCategories:[g.category||"上衣"],displayName:g.name});navigate("/pages/tryon-progress/index");}).catch(e=>{console.warn("[tryon-select] subscribe failed",e);toast("暂时无法开始试穿，请稍后再试");}).finally(()=>{this._starting=false;});},openUpload(){this.setData({uploadVisible:true});},closeUpload(){this.setData({uploadVisible:false});},pickPhoto(e){wx.chooseMedia({count:1,mediaType:["image"],sourceType:e.currentTarget.dataset.mode==="camera"?["camera"]:["album"],success:r=>{const f=r.tempFiles&&r.tempFiles[0];if(!f)return;if(f.size&&f.size>5*1024*1024)return toast("衣物图片不能超过5MB");wx.getImageInfo({src:f.tempFilePath,success:i=>{if(i.width<150||i.width>4096||i.height<150||i.height>4096)return toast("衣物图片尺寸需在150～4096像素之间");this._uploadTempPath=f.tempFilePath;this.setData({uploadVisible:false,infoVisible:true,uploadName:"",uploadCategory:"上衣"});},fail:()=>toast("无法读取衣物图片")});}});},closeInfo(){if(this.data.uploading)return;this.setData({infoVisible:false});},onInfoName(e){this.setData({uploadName:e.detail.value});},onInfoCategory(e){this.setData({uploadCategory:e.currentTarget.dataset.cat});},confirmUpload(){if(this.data.uploading)return;const name=(this.data.uploadName||"").trim();if(!name)return toast("请输入衣物名称");if(!this._uploadTempPath)return toast("请先选择衣物图片");this.setData({uploading:true});wx.showLoading({title:"保存中",mask:true});wx.cloud.uploadFile({cloudPath:"garments/"+Date.now()+"-"+Math.random().toString(36).slice(2,8)+".jpg",filePath:this._uploadTempPath}).then(up=>api.uploadGarment(up.fileID,{name,category:this.data.uploadCategory})).then(g=>{if(!g)throw new Error("保存失败");if(g.pass===false)throw new Error(g.reason||"图片内容不符合要求");this.setData({uploading:false,infoVisible:false,selectedId:g.id,selectedName:g.name||name,garments:this.data.garments.concat([Object.assign({},g,{selected:true})])});this._uploadTempPath="";wx.hideLoading();toast("已保存到我的衣橱");}).catch(e=>{wx.hideLoading();this.setData({uploading:false});toast((e&&e.message)||"保存失败，请重试",2600);});},deleteGarment(e){const id=e.currentTarget.dataset.id;const g=this.data.garments.find(x=>x.id===id);if(!g)return;wx.showModal({title:"删除衣物",content:"删除后不可恢复，但不会影响已经生成的历史试穿结果。",confirmText:"删除",confirmColor:"#C0392B",success:r=>{if(!r.confirm)return;api.deleteMyGarments([id]).then(()=>{const selectedId=this.data.selectedId===id?"":this.data.selectedId;this.setData({selectedId,selectedName:selectedId?this.data.selectedName:"",garments:this.data.garments.filter(x=>x.id!==id)});toast("已删除");}).catch(()=>toast("删除失败，请重试"));}});}});

\\\\n\n### tryon-select/index.wxml\n`\<view class="wx-page"><nav-bar title="选择衣物" showBack="{{true}}" backRoute="/pages/home/index"></nav-bar><view class="content">
  <view class="intro"><text class="title">选择一件要试穿的衣服</text><text class="sub">一次试穿只使用一件衣物。上传只是保存衣物，不会自动消耗试穿次数。</text></view>
  <view wx:if="{{checkingPerson}}" class="notice">正在检查人物基准…</view>
  <view wx:elif="{{!personReady}}" class="notice warn"><view><text class="notice-title">还没有可用的人物照片</text><text class="notice-sub">先添加一张正面全身照，才能开始试穿。</text></view><btn type="secondary" size="sm" bindtap="goPerson">去添加</btn></view>
  <view class="section-head"><text>我的衣物</text><text class="count">{{garments.length}} 件</text></view>
  <view wx:if="{{garments.length===0}}" class="empty-state"><view class="empty-icon"><image src="/assets/icons/png/icon-hanger-gray.png" /></view><text>还没有衣物</text><text class="empty-sub">先上传一件衣物，保存后再选择它试穿。</text><btn type="secondary" size="sm" bindtap="openUpload">上传衣物</btn></view>
  <view wx:else class="garment-grid"><view wx:for="{{garments}}" wx:key="id" class="garment-card {{item.selected?'selected':''}}" data-id="{{item.id}}" bindtap="selectGarment" bindlongpress="deleteGarment"><view class="garment-img"><image src="{{item.image}}" mode="aspectFill"/></view><view class="garment-name">{{item.name}}</view><view class="garment-meta">{{item.category}}<text wx:if="{{item.size_label}}"> · {{item.size_label}}</text></view><view wx:if="{{item.selected}}" class="selected-mark">✓</view></view></view>
  <view class="upload-entry" bindtap="openUpload"><view class="upload-icon"><image src="/assets/icons/png/icon-plus-gray.png" /></view><view><text class="upload-title">添加一件新衣物</text><text class="upload-sub">保存到衣橱后，你再决定是否试穿</text></view><image src="/assets/icons/png/icon-chevron-right-gray.png" style="width:28rpx;height:28rpx"/></view>
  <view class="tip">长按衣物可删除。删除不会影响已经生成的历史试穿结果。</view>
</view><view class="footer-bar"><btn class="footer-main" type="primary" disabled="{{!selectedId || !personReady}}" bindtap="startTryon"><image wx:if="{{selectedId}}" class="btn-icon btn-icon-white" src="/assets/icons/png/icon-hanger-white.png" />{{selectedId ? '试穿「'+selectedName+'」' : '请选择一件衣物'}}</btn></view>
<sheet visible="{{uploadVisible}}" bind:cancel="closeUpload"><view class="sheet-head"><view class="grab"></view><text class="sheet-title">添加衣物</text><text class="sheet-desc">先保存衣物，不会自动开始试穿。</text></view><view class="pick-actions"><view class="pick-btn" data-mode="album" bindtap="pickPhoto"><image src="/assets/icons/png/icon-photo-deep.png" style="width:44rpx;height:44rpx"/><text>从相册选择</text></view><view class="pick-btn" data-mode="camera" bindtap="pickPhoto"><image src="/assets/icons/png/icon-camera-deep.png" style="width:44rpx;height:44rpx"/><text>拍照</text></view></view></sheet>
<sheet visible="{{infoVisible}}" bind:cancel="closeInfo"><view class="sheet-head"><view class="grab"></view><text class="sheet-title">完善衣物信息</text><text class="sheet-desc">保存后会出现在“我的衣物”中。</text></view><view class="info-form"><text class="info-label">衣物名称</text><input class="info-input" maxlength="30" placeholder="例如：米色交叉上衣" value="{{uploadName}}" bindinput="onInfoName"/><text class="info-label">分类</text><view class="cat-grid"><view wx:for="{{categories}}" wx:key="*this" class="cat-chip {{uploadCategory===item?'on':''}}" data-cat="{{item}}" bindtap="onInfoCategory">{{item}}</view></view></view><view slot="actions"><view class="upload-actions"><btn type="primary" loading="{{uploading}}" bindtap="confirmUpload">保存衣物</btn><btn type="secondary" bindtap="closeInfo">取消</btn></view></view></sheet></view>

\\\\n\n### tryon-select/index.wxss\n`\.wx-page{height:100vh;display:flex;flex-direction:column;background:var(--bg);overflow:hidden;padding-bottom:calc(var(--tabbar-h) + env(safe-area-inset-bottom))}.content{flex:1;min-height:0;overflow-y:auto;padding:8rpx 24rpx 48rpx}.intro{padding:26rpx 4rpx 20rpx}.title{display:block;font-size:38rpx;font-weight:700}.sub{display:block;margin-top:10rpx;color:var(--muted);font-size:26rpx;line-height:1.65}.notice{display:flex;align-items:center;justify-content:space-between;gap:20rpx;padding:24rpx;border-radius:var(--radius-md);background:var(--surface);border:1rpx solid var(--border-soft);font-size:26rpx;color:var(--fg-2)}.notice.warn{background:var(--accent-soft);border-color:transparent}.notice-title,.notice-sub{display:block}.notice-title{font-size:28rpx;font-weight:600;color:var(--fg)}.notice-sub{margin-top:6rpx;color:var(--fg-2);font-size:24rpx;line-height:1.5}.section-head{display:flex;justify-content:space-between;align-items:baseline;margin:38rpx 4rpx 20rpx;font-size:32rpx;font-weight:600}.count{font-size:24rpx;color:var(--muted);font-weight:400}.garment-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:24rpx 20rpx}.garment-card{position:relative;padding-bottom:6rpx}.garment-img{height:390rpx;border-radius:var(--radius-md);overflow:hidden;background:var(--surface);border:1rpx solid var(--border-soft);box-shadow:var(--shadow-card)}.garment-img image{width:100%;height:100%}.garment-card.selected .garment-img{border:3rpx solid var(--accent);box-shadow:0 8rpx 24rpx rgba(227,165,149,.22)}.garment-name{font-size:29rpx;font-weight:600;margin-top:12rpx;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.garment-meta{font-size:24rpx;color:var(--muted);margin-top:6rpx}.selected-mark{position:absolute;right:14rpx;top:14rpx;width:48rpx;height:48rpx;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-size:28rpx;border:3rpx solid #fff}.empty-state{display:flex;flex-direction:column;align-items:center;text-align:center;gap:14rpx;padding:70rpx 24rpx;background:var(--surface);border:1rpx solid var(--border-soft);border-radius:var(--radius-lg)}.empty-icon{width:80rpx;height:80rpx;border-radius:50%;background:var(--accent-soft);color:var(--accent-text);display:flex;align-items:center;justify-content:center;font-weight:700}.empty-sub{font-size:25rpx;color:var(--muted);line-height:1.6}.upload-entry{display:flex;align-items:center;gap:18rpx;margin-top:26rpx;padding:24rpx;background:var(--surface);border:1rpx solid var(--border-soft);border-radius:var(--radius-md)}.upload-icon{width:64rpx;height:64rpx;border-radius:50%;background:var(--accent-soft);color:var(--accent-text);display:flex;align-items:center;justify-content:center;font-size:34rpx}.upload-title,.upload-sub{display:block}.upload-title{font-size:28rpx;font-weight:600}.upload-sub{font-size:24rpx;color:var(--muted);margin-top:6rpx}.upload-entry>image{margin-left:auto}.tip{text-align:center;color:var(--muted);font-size:23rpx;padding:26rpx 20rpx}.footer-bar{flex:0 0 auto}.pick-actions{display:flex;gap:20rpx;margin:30rpx 0}.pick-btn{flex:1;display:flex;flex-direction:column;align-items:center;gap:14rpx;padding:34rpx 0;border:1rpx solid var(--border-soft);border-radius:var(--radius-md);background:var(--surface);font-size:27rpx}.info-form{margin-top:24rpx}.info-label{display:block;font-size:27rpx;color:var(--fg-2);margin:20rpx 0 10rpx}.info-input{height:82rpx;border:1rpx solid var(--border);border-radius:var(--radius-md);padding:0 20rpx;background:var(--surface)}.cat-grid{display:grid;grid-template-columns:1fr 1fr;gap:12rpx}.cat-chip{padding:18rpx;text-align:center;border:1rpx solid var(--border);border-radius:999rpx;color:var(--fg-2)}.cat-chip.on{background:var(--accent);border-color:var(--accent);color:#fff}.upload-actions{display:flex;flex-direction:column;gap:14rpx;margin-top:24rpx}
/* V22 */
.intro{padding:22rpx 0 18rpx}.title{font-size:34rpx}.sub{font-size:24rpx}.notice{padding:18rpx;border-radius:18rpx}.section-head{margin-top:28rpx}.garment-grid{gap:22rpx 18rpx}.garment-img{height:360rpx;border-radius:20rpx;box-shadow:none}.garment-card.selected .garment-img{border:3rpx solid var(--accent)}.selected-mark{width:42rpx;height:42rpx;right:12rpx;top:12rpx;font-size:25rpx}.garment-name{font-size:27rpx;margin-top:9rpx}.upload-entry{margin-top:22rpx;padding:18rpx;border-radius:18rpx}.upload-icon{width:54rpx;height:54rpx;font-size:28rpx}.upload-title{font-size:26rpx}.upload-sub{font-size:22rpx}.tip{font-size:21rpx}.pick-btn{border-radius:18rpx;background:var(--surface)}
.empty-icon image{width:38rpx;height:38rpx;opacity:.65}.upload-icon image{width:28rpx;height:28rpx;opacity:.7}

\\\\n\n### tryon-select/index.json\n`\{
  "usingComponents": {
    "nav-bar": "/components/nav-bar/index",
    "btn": "/components/btn/index",
    "seg": "/components/seg/index",
    "garment-item": "/components/garment-item/index",
    "sheet": "/components/sheet/index"
  },
  "navigationBarTitleText": "选择衣物"
}

\\\\n\n
---\n\n## 页面: tryon-progress\n\n### tryon-progress/index.js\n`\const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");
const { nextPollInterval, POLL_MAX_MS } = require("../../utils/poll");

Page({
  data: {
    percent: 0,
    garmentName: "所选衣物",
    stageText: "提交任务中",
    error: false,
    errorMsg: "",
    errorHint: "", // 用户可见的友好提示（技术错误码只进 console，不暴露给用户）
    submitting: true // 提交阶段状态：先展示"提交中"，不阻塞上一页
  },
  onLoad() {
    const pending = wx.getStorageSync("aiTryonPending") || {};
    this.setData({ garmentName: pending.displayName || "所选衣物" });

    // 没有待提交任务：直接读取已有 taskId 开始轮询（从结果页返回等场景）
    const existing = wx.getStorageSync("aiTryonTask") || {};
    if (!pending.garmentIds && existing.taskId) {
      // 失败任务只保留历史 taskId；如果存在 retryPayload，直接显示失败态并允许创建新任务。
      if (existing.status === "failed" && existing.retryPayload) {
        this._pending = existing.retryPayload;
        this.setData({
          submitting: false,
          error: true,
          errorMsg: existing.lastError || "",
          errorHint: "这次没有生成成功，可以重新尝试。"
        });
        return;
      }
      this.taskId = existing.taskId;
      this._pollCount = 0;
      this._pollStartedAt = Date.now();
      this.setData({ submitting: false, stageText: "合成试穿效果图" });
      this.poll();
      return;
    }

    // V1：直接使用当前人物档案提交图片试穿。
    this.submitTask(pending);
  },

  submitTask(pending) {
    // V1 首测前先做无成本运行时检查，避免误把旧 V2/legacy 代码当成当前运行时。
    this._pending = pending;
    api.getTryonDiagnostics().then((diag) => {
      if (diag.runtime !== "v1" || diag.provider !== "aitryon" || diag.model !== "aitryon" || !diag.engineLoaded || !diag.dashscopeConfigured || diag.agnesConfigured || diag.configurationConflict || diag.mockFallback || diag.engineFallback || diag.videoEnabled) {
        throw new Error("试穿服务当前不是 V1 aitryon 运行时，请先完成服务部署/配置检查。");
      }
      return api.getAvatarProfile();
    }).then((profile) => {
      const avatarProfileId = profile && profile.id;
      if (!avatarProfileId) {
        this.setData({
          submitting: false,
          error: true,
          errorMsg: "缺少人物档案，请先完善人物资料。",
          errorHint: "请返回人物资料页完成创建后再试。"
        });
        return;
      }
      this._pending.avatarProfileId = avatarProfileId;
      // 图片任务直接提交：云函数使用 avatarProfileId → Person Asset → Provider。
      return api.submitAiTryon({
        avatarProfileId,
        garmentIds: pending.garmentIds,
        garmentNames: pending.garmentNames,
        garmentImages: pending.garmentImages || []
      });
    })
      .then((res) => {
        // 云函数异常时返回 { ok:false, error } 而非抛异常：同样进入失败态
        if (res && res.error && !res.taskId) {
          console.warn("[tryon-progress] submit error:", res.error);
          this.setData({
            submitting: false,
            error: true,
            errorMsg: res.error,
            errorHint: "这次没有生成成功，可以重新尝试。"
          });
          return;
        }
        // 提交成功：保存 taskId，清除 pending，进入轮询
        // 保存“可重新提交”的完整上下文。失败任务不能作为 retry 的提交源，
        // 否则 retry 会继续轮询已经 FAILED / PROVIDER_TASK_NOT_FOUND 的旧 taskId。
        const retryPayload = {
          garmentId: (pending.garmentIds && pending.garmentIds[0]) || pending.garmentId || "",
          garmentIds: (pending.garmentIds || []).slice(0, 1),
          garmentNames: (pending.garmentNames || []).slice(0, 1),
          garmentImages: (pending.garmentImages || []).slice(0, 1),
          garmentCategories: (pending.garmentCategories || []).slice(0, 1),
          displayName: pending.displayName || "所选衣物",
          avatarProfileId: pending.avatarProfileId || this._pending.avatarProfileId || ""
        };
        wx.setStorageSync("aiTryonTask", {
          taskId: res.taskId,
          status: res.status || "processing",
          garmentName: pending.displayName || "所选衣物",
          retryPayload
        });
        wx.removeStorageSync("aiTryonPending");
        this.taskId = res.taskId;
        this._pollCount = 0;
        this._pollStartedAt = Date.now();
        this.setData({ submitting: false, stageText: "合成试穿效果图" });
        // 图片任务提交即出图完成：无需轮询，直接进入完成动画
        if (res.status === "success" && res.tryonImage) {
          this.animateTo100(res);
          return;
        }
        this.poll();
      })
      .catch((err) => {
        // 提交失败：展示失败态，允许重试（技术细节只记录，不展示给用户）
        console.warn("[tryon-progress] submit exception:", err && err.message);
        const storedTask = wx.getStorageSync("aiTryonTask") || {};
        if (storedTask.taskId) {
          wx.setStorageSync("aiTryonTask", Object.assign({}, storedTask, { status: "failed" }));
        }
        this.setData({
          submitting: false,
          error: true,
          errorMsg: (err && err.message) || "",
          errorHint: "这次没有生成成功，可以重新尝试。"
        });
      });
  },

  poll() {
    api.getAiTryonStatus(this.taskId).then((st) => {
      if (st.status === "failed") {
        console.warn("[tryon-progress] task failed:", st && st.error);
        // 记录终态；不要让后续重新进入页面时误把这个 taskId 当成仍可轮询的任务。
        const storedTask = wx.getStorageSync("aiTryonTask") || {};
        wx.setStorageSync("aiTryonTask", Object.assign({}, storedTask, { status: "failed", lastError: (st && (st.error || st.errorMessage)) || "" }));
        this.setData({ error: true, errorMsg: (st && st.error) || "", errorHint: "这次没有生成成功，可以重新尝试。" });
        return;
      }
      const providerStatusText = {
        PENDING: '排队中',
        'PRE-PROCESSING': '准备人物与衣物',
        RUNNING: 'AI 正在生成',
        'POST-PROCESSING': '正在整理结果'
      };
      this.setData({
        stageText: providerStatusText[st.providerStatus] || 'AI 正在生成'
      });
      if (st.status !== "success") {
        if (Date.now() - this._pollStartedAt > POLL_MAX_MS) {
          this.setData({ error: true, errorMsg: "", errorHint: "生成仍在后台进行，可稍后在试穿记录查看结果。" });
          return;
        }
        this._pollCount += 1;
        this._pollTimer = setTimeout(() => this.poll(), nextPollInterval(this._pollCount));
        return;
      }
      this.animateTo100(st);
    }).catch(() => {
      // 接口异常：展示失败态与重试入口，而不是伪造成功结果误导用户
      this.setData({ error: true, errorMsg: "", errorHint: "网络不太稳定，请再试一次。" });
    });
  },

  retry() {
    // V20：失败后的“重新生成”必须创建全新的 Provider 任务。
    // 旧 taskId 即使仍保存在本地缓存，也只能用于历史追踪，不能再次轮询/提交。
    const pending = wx.getStorageSync("aiTryonPending") || {};
    const storedTask = wx.getStorageSync("aiTryonTask") || {};
    const retryPayload = storedTask.retryPayload || null;
    const resubmitPayload = (pending.garmentIds && pending.garmentIds.length) ? pending : retryPayload;

    if (resubmitPayload && resubmitPayload.garmentIds && resubmitPayload.garmentIds.length === 1) {
      const freshPending = Object.assign({}, resubmitPayload, {
        garmentId: resubmitPayload.garmentId || resubmitPayload.garmentIds[0],
        avatarProfileId: resubmitPayload.avatarProfileId || (this._pending && this._pending.avatarProfileId) || ""
      });
      // 清掉旧 task 的“处理中”语义，避免 submit 时被任何本地状态误导。
      this.clearTimers();
      this.setData({ error: false, errorMsg: "", errorHint: "", percent: 0, stageText: "提交任务中", submitting: true });
      this.submitTask(freshPending);
      return;
    }

    // V20：即使本地没有 retryPayload，也可以让云函数依据旧失败 task 恢复原始人物/衣物上下文，创建全新 Provider 任务。
    if (this.taskId && storedTask.status === "failed") {
      this.clearTimers();
      this.setData({ error: false, errorMsg: "", errorHint: "", percent: 0, stageText: "提交任务中", submitting: true });
      api.retryAiTryon(this.taskId).then((res) => {
        if (!res || !res.taskId) throw new Error("重新生成未返回新任务");
        const retryPayload = storedTask.retryPayload || this._pending || {};
        wx.setStorageSync("aiTryonTask", {
          taskId: res.taskId,
          status: res.status || "processing",
          garmentName: retryPayload.displayName || this.data.garmentName || "所选衣物",
          retryPayload
        });
        this.taskId = res.taskId;
        this._pollCount = 0;
        this._pollStartedAt = Date.now();
        this.setData({ submitting: false, stageText: "合成试穿效果图" });
        this.poll();
      }).catch((err) => {
        this.setData({ submitting: false, error: true, errorMsg: (err && err.message) || "", errorHint: "这次没有生成成功，可以重新尝试。" });
      });
      return;
    }

    // 没有足够上下文时才允许继续轮询现有 task。
    if (this.taskId && storedTask.status !== "failed") {
      this.clearTimers();
      this._pollCount = 0;
      this._pollStartedAt = Date.now();
      this.setData({ error: false, errorMsg: "", errorHint: "", percent: 0, stageText: "合成试穿效果图", submitting: false });
      this.poll();
    } else {
      this.setData({ error: true, errorMsg: "", errorHint: "缺少本次试穿信息，请返回重新选择衣物。" });
    }
  },

  backToSelect() {
    navigate("/pages/tryon-select/index");
  },

  animateTo100(st) {
    this.clearTimers();
    // submitTask 挂载的 pending：用于构造单件衣物清单（供结果页保存模板按衣物归档）
    const pending = this._pending || {};
    // 无 pending 重入（仅 taskId 轮询）时保留已存的衣物明细，避免覆盖丢失
    const prevResult = wx.getStorageSync("aiTryonResult") || {};
    // 禁止 success + 无真实图片进入成功结果页
    const realImage = st.tryonImage || st.tryonImageUrl || "";
    if (st.status === "success" && !realImage) {
      this.setData({
        error: true,
        errorMsg: "",
        errorHint: "生成结果暂时不可用，请稍后重试。"
      });
      return;
    }
    this._startTimer = setTimeout(() => {
      // 40ms/帧（25fps）：顺滑且避免高频 setData 通信拥堵
      this._frameTimer = setInterval(() => {
        const p = this.data.percent + 1;
        this.setData({ percent: p });
        if (p >= 100) {
          clearInterval(this._frameTimer);
          this._frameTimer = null;
          wx.setStorageSync("aiTryonResult", {
            resultId: st.resultId || "",
            taskId: st.taskId || "",
            garmentId: (pending.garmentIds && pending.garmentIds[0]) || "",
            personAssetId: st.personAssetId || pending.personAssetId || "",
            avatarViewId: "",
            avatarProfileId: pending.avatarProfileId || "",
            tryonImage: realImage,
            tryonImageUrl: st.tryonImageUrl || "",
            imageTaskId: st.taskId || "",
            tryonVideo: st.tryonVideo || "",
            garmentName: this.data.garmentName,
            garments: pending.garmentIds ? pending.garmentIds.map((id, i) => ({
              id,
              name: pending.garmentNames[i],
              image: pending.garmentImages[i],
              category: pending.garmentCategories[i] || "上衣"
            })) : (prevResult.garments || [])
          });
          toast("生成完成 · 效果仅供参考");
          this._navTimer = setTimeout(() => navigate("/pages/tryon-result/index"), 1400);
        }
      }, 40);
    }, 300);
  },

  clearTimers() {
    if (this._frameTimer) { clearInterval(this._frameTimer); this._frameTimer = null; }
    if (this._startTimer) { clearTimeout(this._startTimer); this._startTimer = null; }
    if (this._navTimer) { clearTimeout(this._navTimer); this._navTimer = null; }
    if (this._pollTimer) { clearTimeout(this._pollTimer); this._pollTimer = null; }
  },

  onHide() {
    // 页面不可见时停止轮询/动画/跳转，避免后台持续请求与 setData
    this.clearTimers();
  },

  onShow() {
    // 回到页面：未完成则继续轮询进度
    if (!this.data.error && this.data.percent < 100 && !this.data.submitting) {
      this.poll();
    }
  },

  onUnload() {
    this.clearTimers();
  }
});

\\\\n\n### tryon-progress/index.wxml\n`\<view class="wx-page">
  <nav-bar title="正在生成穿搭" showBack="{{true}}"></nav-bar>

  <view class="content gen-layout">
    <!-- 提交任务阶段 -->
    <block wx:if="{{submitting && !error}}">
      <view class="pulse-wrap">
        <view class="pulse-dot"></view>
        <view class="pulse-dot d2"></view>
        <view class="pulse-dot d3"></view>
      </view>
      <view class="gen-title">正在准备生成</view>
      <view class="gen-sub">正在将衣物合成到你的真实人物照片上</view>

      <view class="gen-cards">
        <view class="gen-card">
          <view class="gc-ic"><image class="ic-img" style="width:34rpx;height:34rpx" src="/assets/icons/png/icon-star-deep.png" /></view>
          <view class="gc-label">当前阶段</view>
          <view class="gc-val">准备中</view>
        </view>
        <view class="gen-card">
          <view class="gc-ic"><image class="ic-img" style="width:34rpx;height:34rpx" src="/assets/icons/png/icon-clock-deep.png" /></view>
          <view class="gc-label">预计耗时</view>
          <view class="gc-val">通常需要几十秒</view>
        </view>
      </view>

      <view class="hint center mt-20">请稍候，即将开始生成</view>
    </block>

    <!-- 正常轮询阶段 -->
    <block wx:if="{{!submitting && !error}}">
      <view class="ring-wrap">
        <view class="ring" style="--p: {{percent}};"></view>
        <view class="ring-hole"></view>
        <view class="ring-num mono">{{percent}}<text class="pct">%</text></view>
      </view>
      <view class="gen-title">正在生成穿搭效果</view>
      <view class="gen-sub">正在将「{{garmentName}}」合成到你的人物照片上</view>

      <view class="gen-cards">
        <view class="gen-card">
          <view class="gc-ic"><image class="ic-img" style="width:34rpx;height:34rpx" src="/assets/icons/png/icon-star-deep.png" /></view>
          <view class="gc-label">当前阶段</view>
          <view class="gc-val">{{stageText}}</view>
        </view>
        <view class="gen-card">
          <view class="gc-ic"><image class="ic-img" style="width:34rpx;height:34rpx" src="/assets/icons/png/icon-clock-deep.png" /></view>
          <view class="gc-label">预计耗时</view>
          <view class="gc-val">通常需要几十秒</view>
        </view>
      </view>

      <view class="hint center mt-20">生成完成后会自动显示结果</view>
    </block>

    <!-- 失败态 -->
    <block wx:if="{{error}}">
      <view class="gen-title">暂时没生成成功</view>
      <view class="gen-sub">{{errorHint || '这次没有生成成功，可以重新尝试。'}}</view>
      <view class="err-actions">
        <btn class="retry-btn" type="primary" bindtap="retry"><image class="btn-icon btn-icon-white" src="/assets/icons/png/icon-rotate-active.png" />重新生成</btn>
        <btn class="back-btn" bindtap="backToSelect">返回重选衣物</btn>
      </view>
    </block>
  </view>

  <tab-bar selected="{{1}}" navMode="{{true}}"></tab-bar>
</view>

\\\\n\n### tryon-progress/index.wxss\n`\.wx-page { height: 100vh; display: flex; flex-direction: column; background: var(--bg); overflow: hidden; }
.nav-btn { width: 80rpx; height: 80rpx; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); color: var(--fg); transition: background 0.15s ease; }
.nav-btn-hover { background: var(--surface-2); }
.nav-btn .iconfont { font-size: 42rpx; }
.content { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48rpx 0; }
.progress-ring { position: relative; width: 280rpx; height: 280rpx; }
.progress-ring .ring-bg { stroke: var(--border-soft); }
.progress-ring .ring-fill { stroke: var(--accent); stroke-linecap: round; transition: stroke-dashoffset 0.3s var(--ease); }
.progress-text { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; }
.progress-percent { font-size: 56rpx; font-weight: 700; color: var(--fg); }
.progress-label { font-size: 24rpx; color: var(--fg-2); margin-top: 8rpx; }
.step-list { margin-top: 56rpx; width: 100%; max-width: 560rpx; }
.step-item { display: flex; align-items: center; gap: 20rpx; padding: 20rpx 0; }
.step-dot { width: 24rpx; height: 24rpx; border-radius: 50%; background: var(--border); flex-shrink: 0; transition: all 0.3s var(--ease); }
.step-item.done .step-dot { background: var(--accent); box-shadow: 0 0 0 6rpx var(--accent-soft); }
.step-item.active .step-dot { background: var(--accent); animation: pulse 1.5s infinite; }
.step-text { font-size: 28rpx; color: var(--fg-2); }
.step-item.done .step-text { color: var(--fg); font-weight: 500; }
.step-item.active .step-text { color: var(--accent-text); font-weight: 600; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
/* V22 */
.gen-layout{padding-top:40rpx}.gen-title{font-size:34rpx;font-weight:700}.gen-sub{font-size:24rpx;color:var(--muted);max-width:560rpx}.gen-cards{gap:12rpx}.gen-card{border-radius:20rpx;padding:22rpx 18rpx;box-shadow:none}.gc-ic{width:52rpx;height:52rpx;border-radius:16rpx}.gc-label{font-size:22rpx}.gc-val{font-size:25rpx}.err-actions{gap:12rpx}
.btn-icon-white{filter:brightness(0) invert(1)}

\\\\n\n### tryon-progress/index.json\n`\{
  "usingComponents": {
    "nav-bar": "/components/nav-bar/index",
    "tab-bar": "/components/tabbar/index",
    "btn": "/components/btn/index"
  },
  "navigationBarTitleText": "正在试穿"
}

\\\\n\n
---\n\n## 页面: tryon-result\n\n### tryon-result/index.js\n`\const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: {
    collectVisible: false,
    collecting: false,
    result: { tryonImage: "", tryonVideo: "", garmentName: "AI 试穿", garments: [] }
  },
  onLoad() {
    const r = wx.getStorageSync("aiTryonResult") || {};
    // 禁止默认 AI 示例图片：无真实图片则返回选择页
    if (!r.tryonImage && !r.tryonImageUrl) {
      navigate("/pages/tryon-select/index", { reLaunch: true });
      return;
    }
    this.setData({
      result: Object.assign({ tryonImage: "", tryonVideo: "", garmentName: "AI 试穿", garments: [] }, r),
      collecting: false
    });
  },

  /* ---------- 收藏 ---------- */
  onCollect() {
    if (this._collecting) return;
    this.setData({ collectVisible: true });
  },
  closeCollect() { this.setData({ collectVisible: false }); },

  // 云文件 ID / 网络图先下载再存相册；包内资源路径直接保存
  saveToAlbum(src, done, fail) {
    if (!src) { fail && fail("无图可保存"); return; }
    const doSave = (path) => wx.saveImageToPhotosAlbum({
      filePath: path,
      success: () => done && done(),
      fail: (e) => fail && fail((e && e.errMsg) || "保存失败")
    });
    if (src.indexOf("cloud://") === 0 || src.indexOf("http") === 0) {
      if (src.indexOf("cloud://") === 0 && wx.cloud) {
        wx.cloud.downloadFile({ fileID: src, success: (r) => doSave(r.tempFilePath), fail: () => fail && fail("图片下载失败") });
      } else {
        wx.downloadFile({ url: src, success: (r) => doSave(r.tempFilePath), fail: () => fail && fail("图片下载失败") });
      }
    } else {
      doSave(src);
    }
  },

  collectYes() {
    // 是：收藏 + 保存图片到相册
    if (this._collecting) return;
    this._collecting = true;
    this.setData({ collectVisible: false });
    api.saveAiResult({
      taskId: this.data.result.imageTaskId || this.data.result.taskId || "",
      garmentName: this.data.result.garmentName,
      tryonImage: this.data.result.tryonImage,
      saved: true
    }).then(() => {
      this._collecting = false;
      this.setData({ collecting: true });
      this.saveToAlbum(this.data.result.tryonImage,
        () => toast("已收藏并保存到相册"),
        () => toast("已收藏；保存到相册失败，可在相册权限开启后重试"));
    }).catch(() => {
      this._collecting = false;
      toast("收藏失败，请重试");
    });
  },

  collectNo() {
    // 否：仅收藏（图片）
    if (this._collecting) return;
    this._collecting = true;
    this.setData({ collectVisible: false });
    api.saveAiResult({
      taskId: this.data.result.imageTaskId || this.data.result.taskId || "",
      garmentName: this.data.result.garmentName,
      tryonImage: this.data.result.tryonImage,
      saved: false
    }).then(() => {
      this._collecting = false;
      this.setData({ collecting: true });
      toast("已收藏");
    }).catch(() => {
      this._collecting = false;
      toast("收藏失败，请重试");
    });
  },

  onRetry() {
    const r = this.data.result || {};
    const garmentId = r.garmentId || (r.garments && r.garments[0] && r.garments[0].id) || "";
    if (!garmentId) return toast("找不到这次试穿的衣物，请从衣橱重新选择");
    const g = (r.garments || []).find(x => x.id === garmentId);
    wx.setStorageSync("aiTryonPending", {
      garmentId, garmentIds: [garmentId], garmentNames: [g ? g.name : (r.garmentName || "所选衣物")],
      garmentImages: [g ? g.image : ""], garmentCategories: [g ? (g.category || "上衣") : "上衣"],
      displayName: g ? g.name : (r.garmentName || "所选衣物")
    });
    navigate("/pages/tryon-progress/index");
  },

  /* ---------- 分享 ---------- */
  onShare() {
    // 分享按钮由 open-type="share" 触发系统分享，这里仅做提示
    toast("分享内容含「AI 生成效果，仅供参考」标识");
  },
  onShareAppMessage() {
    // 分享卡片：仅分享图片（不分享视频）
    return {
      title: "「" + (this.data.result.garmentName || "AI 试穿") + "」AI 试穿效果（AI 生成效果，仅供参考）",
      path: "/pages/home/index",
      imageUrl: this.data.result.tryonImage
    };
  },

});

\\\\n\n### tryon-result/index.wxml\n`\<view class="wx-page">
  <nav-bar title="穿搭效果" showBack="{{true}}"></nav-bar>
  <view class="content">
    <view class="photo-card"><image src="{{result.tryonImage}}" mode="widthFix" class="result-img"/><view class="wm">AI 生成效果，仅供参考</view></view>
    <view class="result-meta"><view class="rm-title">{{result.garmentName}}</view><view class="rm-sub">根据你的人物照片生成，效果可能与真实穿着存在差异。</view></view>
    <view class="action-list">
      <view class="action-item" hover-class="action-hover" bindtap="onCollect"><image class="action-icon" src="/assets/icons/svg/ic-heart.svg"/><text class="action-label">收藏结果</text><text class="action-hint">保存到试穿记录</text></view>
      <view class="action-item" hover-class="action-hover" bindtap="onRetry"><image class="action-icon" src="/assets/icons/png/icon-rotate-active.png"/><text class="action-label">再试一次</text><text class="action-hint">重新生成同一件衣物</text></view>
      <view class="action-item" hover-class="action-hover" bindtap="onShare"><image class="action-icon" src="/assets/icons/svg/ic-share.svg"/><text class="action-label">分享</text><text class="action-hint">发送给好友</text><button class="share-btn" open-type="share" style="position:absolute;inset:0;opacity:0"></button></view>
    </view>
  </view>
  <tab-bar selected="{{1}}" navMode="{{true}}"></tab-bar>
  <sheet visible="{{collectVisible}}" bind:cancel="closeCollect">
    <view class="sheet-head"><view class="grab"></view><text class="sheet-title">收藏结果</text><text class="sheet-desc">是否同时保存到手机相册？</text></view>
    <view slot="actions"><view class="collect-actions"><btn class="collect-btn" type="primary" bindtap="collectYes"><image class="btn-icon btn-icon-white" src="/assets/icons/png/icon-save-gray.png" />保存到相册</btn><btn class="collect-btn" type="secondary" bindtap="collectNo"><image class="btn-icon" src="/assets/icons/png/icon-heart-gray.png" />仅收藏</btn></view></view>
  </sheet>
</view>

\\\\n\n### tryon-result/index.wxss\n`\.wx-page { height: 100vh; display: flex; flex-direction: column; background: var(--bg); overflow: hidden; padding-bottom: env(safe-area-inset-bottom); }

/* 图片卡片 */
.photo-card { position: relative; border-radius: var(--radius-lg); overflow: hidden; border: 1rpx solid var(--border-soft); background: var(--surface); box-shadow: var(--shadow-raise); }
.result-img { width: 100%; display: block; }
.wm { position: absolute; left: 50%; bottom: 24rpx; transform: translateX(-50%); background: rgba(31,29,27,0.6); color: rgba(255,255,255,0.92); font-size: 24rpx; padding: 8rpx 24rpx; border-radius: 999rpx; white-space: nowrap; backdrop-filter: blur(8rpx); }

/* 穿搭信息 */
.result-meta { display: block; margin-top: 32rpx; display: flex; align-items: flex-start; justify-content: space-between; gap: 20rpx; }
.rm-copy { flex: 1; min-width: 0; }
.rm-title { font-size: 34rpx; font-weight: 600; }
.rm-sub { font-size: 27rpx; color: var(--fg-2); margin-top: 10rpx; line-height: 1.6; }

/* 操作按钮列表：纵向排列 */
.action-list { margin-top: 36rpx; display: flex; flex-direction: column; gap: 20rpx; }
.action-item { display: flex; align-items: center; gap: 28rpx; padding: 32rpx 36rpx; border-radius: var(--radius-md); background: var(--surface); border: 1rpx solid var(--border-soft); box-shadow: var(--shadow-card); position: relative; transition: all 0.2s var(--ease); }
.action-hover { background: var(--accent-soft); box-shadow: var(--shadow-card-hover); }
.action-active { background: var(--accent-soft); border-color: var(--accent); }
.action-icon { width: 44rpx; height: 44rpx; flex-shrink: 0; }
.action-label { font-size: 30rpx; font-weight: 600; color: var(--fg); flex-shrink: 0; }
.action-hint { font-size: 26rpx; color: var(--fg-2); margin-left: auto; text-align: right; }

/* 分享按钮透明覆盖层 */
.share-btn { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; padding: 0; margin: 0; border: none; background: transparent; }

/* 视频操作项：轻微区分 */

/* 弹层通用 */
.sheet-head { display: flex; flex-direction: column; gap: 8rpx; }
.grab { width: 80rpx; height: 8rpx; border-radius: 4rpx; background: var(--border); margin: 0 auto 20rpx; }
.sheet-title { font-size: 34rpx; font-weight: 600; }
.sheet-desc { font-size: 28rpx; color: var(--fg-2); line-height: 1.65; margin-top: 12rpx; }
.sheet-action { display: block; flex: 1; }
.template-actions { display: flex; flex-direction: column; gap: 24rpx; margin-top: 28rpx; }
.template-actions .sheet-action { width: 100%; }
.collect-actions { display: flex; flex-direction: column; gap: 24rpx; }
.collect-btn { display: block; width: 100%; }
.tpl-form { margin-top: 28rpx; }
.tpl-field { margin-top: 24rpx; }
.tpl-label { font-size: 28rpx; color: var(--fg-2); display: block; margin-bottom: 12rpx; }
.tpl-input { border: 1px solid var(--border); background: var(--surface); border-radius: var(--radius-md); height: 84rpx; padding: 0 24rpx; font-size: 28rpx; color: var(--fg); }
.cat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16rpx; }
.cat-chip { display: flex; align-items: center; justify-content: center; min-height: 76rpx; border-radius: 999rpx; border: 1px solid var(--border); background: var(--surface); color: var(--fg-2); font-size: 28rpx; }
.cat-chip.on { background: var(--accent); border-color: var(--accent); color: var(--accent-on); font-weight: 600; }
.cat-chip-hover { opacity: 0.85; }

/* V22 */
.content{padding-top:12rpx}.photo-card{height:auto;min-height:680rpx;border-radius:22rpx;box-shadow:none}.result-meta{padding:20rpx 4rpx 8rpx}.rm-title{font-size:30rpx;font-weight:700}.rm-sub{font-size:23rpx;color:var(--muted);line-height:1.55;margin-top:6rpx}.action-list{display:grid;grid-template-columns:repeat(3,1fr);gap:10rpx;margin-top:18rpx}.action-item{position:relative;min-height:150rpx;padding:22rpx 12rpx 18rpx;border:1rpx solid var(--border-soft);background:var(--surface);border-radius:20rpx;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.action-icon{width:36rpx;height:36rpx;margin-bottom:12rpx}.action-label{font-size:25rpx;font-weight:600}.action-hint{font-size:20rpx;color:var(--muted);margin-top:5rpx;line-height:1.35}.action-hover{background:var(--surface-2);transform:scale(.985)}
.collect-btn{display:flex;align-items:center;justify-content:center}.collect-btn .btn-icon{flex:0 0 auto}

\\\\n\n### tryon-result/index.json\n`\{
  "usingComponents": {
    "nav-bar": "/components/nav-bar/index",
    "btn": "/components/btn/index",
    "chip": "/components/chip/index",
    "card": "/components/card/index",
    "sheet": "/components/sheet/index",
    "tab-bar": "/components/tabbar/index"
  },
  "navigationBarTitleText": "穿搭效果"
}

\\\\n\n
---\n\n## 页面: history\n\n### history/index.js\n`\const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: { records: [], manageMode: false, delSelectedMap: {}, delCount: 0 },
  onShow() {
    // 试穿记录已移入「我的」体系：页面为普通页，底部 Tab 高亮「我的」
    // 仅在 onShow 加载（onLoad 后必触发 onShow，双处调用会重复请求）
    this.loadRecords();
  },
  loadRecords() {
    api.getHistory().then((records) => {
      this.setData({ records });
    }).catch(() => this.setData({ records: [] }));
  },
  toggleManage() {
    this.setData({ manageMode: !this.data.manageMode, delSelectedMap: {}, delCount: 0 });
  },
  onItemTap(e) {
    if (this.data.manageMode) {
      // 选中态存进 map（WXML 不支持数组方法调用，AGENTS.md §7）
      const id = e.detail.id;
      const delSelectedMap = Object.assign({}, this.data.delSelectedMap);
      if (delSelectedMap[id]) {
        delete delSelectedMap[id];
      } else {
        delSelectedMap[id] = true;
      }
      this.setData({ delSelectedMap, delCount: Object.keys(delSelectedMap).length });
    } else {
      const item = this.data.records.find((r) => r.id === e.detail.id);
      if (item && item.image) {
        wx.setStorageSync("aiTryonResult", {
          resultId: item.resultId || item.id,
          taskId: item.taskId || "",
          garmentId: item.garmentId || "",
          personAssetId: item.personAssetId || "",
          avatarViewId: "",
          tryonImage: item.image,
          tryonVideo: item.videoUrl || "",
          garmentName: item.garmentName
        });
      }
      navigate("/pages/tryon-result/index");
    }
  },
  onLongPress(e) {
    if (!this.data.manageMode) {
      this.setData({ manageMode: true, delSelectedMap: { [e.detail.id]: true }, delCount: 1 });
    }
  },
  onDelete() {
    const ids = Object.keys(this.data.delSelectedMap);
    if (ids.length === 0) {
      toast("请先选择要删除的记录");
      return;
    }
    wx.showModal({
      title: "删除试穿记录",
      content: `将删除 ${ids.length} 条试穿记录，删除后不可恢复。`,
      confirmText: "删除",
      confirmColor: "#C0392B",
      success: (res) => {
        if (res.confirm) {
          api.deleteItems("history", ids).then(() => {
            toast("已删除");
            this.setData({ manageMode: false, delSelectedMap: {}, delCount: 0 });
            this.loadRecords();
          }).catch(() => {
            toast("删除失败，请重试");
          });
        }
      }
    });
  }
});

\\\\n\n### history/index.wxml\n`\<view class="wx-page">
  <nav-bar title="试穿记录" showBack="{{true}}" backRoute="/pages/profile/index">
    <view wx:if="{{manageMode}}" slot="right" class="manage-btn" hover-class="manage-hover" bindtap="toggleManage">完成</view>
  </nav-bar>

  <view class="content">
    <view wx:if="{{records.length === 0}}" class="empty-state">
      <view class="es-ic"><image class="ic-img" style="width:40rpx;height:40rpx" src="/assets/icons/png/icon-heart-gray.png" /></view>
      <text class="es-text">暂无试穿记录，去试试第一件吧</text>
    </view>

    <view wx:else class="masonry">
      <record-item
        wx:for="{{records}}"
        wx:key="id"
        data="{{item}}"
        selected="{{manageMode && delSelectedMap[item.id]}}"
        bindtap="onItemTap"
        bind:longpress="onLongPress"
      />
    </view>

    <view class="hint center mt-32">以上为 AI 生成效果，仅供参考</view>
  </view>

  <view wx:if="{{manageMode}}" class="delete-bar">
    <btn class="delete-btn" type="danger" bindtap="onDelete">
      删除所选（{{delCount}}）
    </btn>
  </view>

  <tab-bar selected="{{2}}" navMode="{{true}}"></tab-bar>
</view>

\\\\n\n### history/index.wxss\n`\.wx-page { height: 100vh; display: flex; flex-direction: column; background: var(--bg); overflow: hidden; padding-bottom: calc(var(--tabbar-h) + env(safe-area-inset-bottom)); }
.nav-btn { width: 80rpx; height: 80rpx; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); color: var(--fg); transition: background 0.15s ease; }
.nav-btn-hover { background: var(--surface-2); }
.nav-btn .iconfont { font-size: 42rpx; }
.manage-btn { font-size: 26rpx; color: var(--accent-text); padding: 10rpx 16rpx; font-weight: 500; }
.manage-hover { opacity: 0.8; }
.content { flex: 1; overflow-y: auto; padding: 8rpx 0 8rpx; }
.hint { font-size: 25rpx; color: var(--fg-2); margin: 32rpx 4rpx 40rpx; }
.history-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24rpx; }
.history-hover .history-card { box-shadow: var(--shadow-card-hover); transform: scale(0.985); }
.history-card { position: relative; border-radius: var(--radius-lg); overflow: hidden; border: 1rpx solid var(--border-soft); background: var(--surface); box-shadow: var(--shadow-card); transition: all 0.2s var(--ease); }
.history-img { width: 100%; height: 420rpx; }
.history-meta { padding: 20rpx 24rpx 24rpx; }
.history-name { font-size: 28rpx; font-weight: 600; }
.history-sub { font-size: 24rpx; color: var(--fg-2); margin-top: 8rpx; line-height: 1.55; }
.history-check { position: absolute; top: 20rpx; left: 20rpx; z-index: 2; }
.history-del { position: absolute; top: 20rpx; right: 20rpx; z-index: 2; }
.history-empty { padding: 120rpx 40rpx; text-align: center; }
.history-empty .hint { margin: 28rpx 0 40rpx; }
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 20rpx; padding: 68rpx 32rpx; text-align: center; }
.es-ic { width: 84rpx; height: 84rpx; border-radius: var(--radius-md); background: var(--surface-2); color: var(--fg-2); display: flex; align-items: center; justify-content: center; }
.es-ic .iconfont { font-size: 40rpx; }
.es-text { font-size: 26rpx; color: var(--fg-2); }
.delete-bar { flex: 0 0 auto; padding: 28rpx 28rpx calc(28rpx + env(safe-area-inset-bottom)); background: var(--bg); border-top: 1rpx solid var(--border-soft); display: flex; gap: 24rpx; }
.delete-bar-btn, .delete-btn-sm { flex: 1; min-width: 0; }
.delete-bar-btn { display: inline-flex; align-items: center; justify-content: center; padding: 0 28rpx; }
.delete-btn-sm { display: inline-flex; align-items: center; justify-content: center; gap: 8rpx; padding: 0 28rpx; }
/* V22 */
.content{padding-top:14rpx}.empty-state{padding:90rpx 28rpx;border-radius:22rpx}.es-ic{width:64rpx;height:64rpx;border-radius:18rpx;background:var(--surface-2);display:flex;align-items:center;justify-content:center}.es-text{font-size:25rpx;color:var(--fg-2);text-align:center}.delete-bar{padding:12rpx 28rpx calc(12rpx + env(safe-area-inset-bottom));background:rgba(248,244,238,.96);border-top:1rpx solid var(--border-soft)}

\\\\n\n### history/index.json\n`\{
  "usingComponents": {
    "nav-bar": "/components/nav-bar/index",
    "record-item": "/components/record-item/index",
    "tab-bar": "/components/tabbar/index",
    "btn": "/components/btn/index"
  },
  "navigationBarTitleText": "试穿记录"
}

\\\\n\n
---\n\n## 页面: favorites\n\n### favorites/index.js\n`\const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: { favorites: [], manageMode: false, delSelectedMap: {}, delCount: 0 },
  onShow() {
    // 仅在 onShow 加载（onLoad 后必触发 onShow，双处调用会重复请求）
    this.loadFavorites();
  },
  loadFavorites() {
    api.getFavorites().then((favorites) => {
      this.setData({ favorites });
    }).catch(() => this.setData({ favorites: [] }));
  },
  toggleManage() {
    this.setData({ manageMode: !this.data.manageMode, delSelectedMap: {}, delCount: 0 });
  },
  onItemTap(e) {
    if (this.data.manageMode) {
      // 选中态存进 map（WXML 不支持数组方法调用，AGENTS.md §7）
      const id = e.detail.id;
      const delSelectedMap = Object.assign({}, this.data.delSelectedMap);
      if (delSelectedMap[id]) {
        delete delSelectedMap[id];
      } else {
        delSelectedMap[id] = true;
      }
      this.setData({ delSelectedMap, delCount: Object.keys(delSelectedMap).length });
    } else {
      const item = this.data.favorites.find((r) => r.id === e.detail.id);
      if (item && item.image) {
        wx.setStorageSync("aiTryonResult", {
          tryonImage: item.image,
          tryonVideo: item.videoUrl || "",
          garmentName: item.garmentName
        });
      }
      navigate("/pages/tryon-result/index");
    }
  },
  onLongPress(e) {
    if (!this.data.manageMode) {
      this.setData({ manageMode: true, delSelectedMap: { [e.detail.id]: true }, delCount: 1 });
    }
  },
  onDelete() {
    const ids = Object.keys(this.data.delSelectedMap);
    if (ids.length === 0) {
      toast("请先选择要删除的收藏");
      return;
    }
    wx.showModal({
      title: "取消收藏",
      content: `将删除 ${ids.length} 条收藏，删除后不可恢复。`,
      confirmText: "删除",
      confirmColor: "#C0392B",
      success: (res) => {
        if (res.confirm) {
          api.deleteItems("favorites", ids).then(() => {
            toast("已删除");
            this.setData({ manageMode: false, delSelectedMap: {}, delCount: 0 });
            this.loadFavorites();
          }).catch(() => {
            toast("删除失败，请重试");
          });
        }
      }
    });
  }
});

\\\\n\n### favorites/index.wxml\n`\<view class="wx-page">
  <nav-bar title="收藏">
    <view wx:if="{{manageMode}}" slot="right" class="manage-btn" hover-class="manage-hover" bindtap="toggleManage">完成</view>
  </nav-bar>

  <view class="content">
    <view wx:if="{{favorites.length === 0 && !manageMode}}" class="empty-state">
      <view class="es-ic"><image class="es-img" src="/assets/icons/png/icon-heart-gray.png" mode="aspectFit" /></view>
      <text class="es-text">还没有收藏。试穿结果页可以把喜欢的效果保存到这里。</text>
    </view>

    <view wx:if="{{favorites.length > 0}}" class="fav-grid">
      <record-item
        wx:for="{{favorites}}"
        wx:key="id"
        data="{{item}}"
        selected="{{manageMode && delSelectedMap[item.id]}}"
        bindtap="onItemTap"
        bind:longpress="onLongPress"
      />
    </view>

    <view wx:if="{{favorites.length > 0}}" class="hint center mt-32">以上为 AI 生成效果，仅供参考</view>
  </view>

  <view wx:if="{{manageMode}}" class="delete-bar">
    <btn class="delete-btn" type="danger" bindtap="onDelete">
      删除所选（{{delCount}}）
    </btn>
  </view>
</view>

\\\\n\n### favorites/index.wxss\n`\.wx-page { height: 100vh; display: flex; flex-direction: column; background: var(--bg); overflow: hidden; padding-bottom: calc(var(--tabbar-h) + env(safe-area-inset-bottom)); }
.nav-btn { width: 80rpx; height: 80rpx; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); color: var(--fg); transition: background 0.15s ease; }
.nav-btn-hover { background: var(--surface-2); }
.nav-btn .iconfont { font-size: 42rpx; }
.manage-btn { font-size: 26rpx; color: var(--accent-text); padding: 10rpx 16rpx; font-weight: 500; }
.manage-hover { opacity: 0.8; }
.content { flex: 1; overflow-y: auto; padding: 8rpx 0 8rpx; }
.hint { font-size: 25rpx; color: var(--fg-2); margin: 32rpx 4rpx 40rpx; }
.fav-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24rpx; }
.fav-hover .fav-card { box-shadow: var(--shadow-card-hover); transform: scale(0.985); }
.fav-card { position: relative; border-radius: var(--radius-lg); overflow: hidden; border: 1rpx solid var(--border-soft); background: var(--surface); box-shadow: var(--shadow-card); transition: all 0.2s var(--ease); }
.fav-img { width: 100%; height: 420rpx; }
.fav-meta { padding: 20rpx 24rpx 24rpx; }
.fav-name { font-size: 28rpx; font-weight: 600; }
.fav-sub { font-size: 24rpx; color: var(--fg-2); margin-top: 8rpx; line-height: 1.55; }
.fav-check { position: absolute; top: 20rpx; left: 20rpx; z-index: 2; }
.fav-del { position: absolute; top: 20rpx; right: 20rpx; z-index: 2; }
.fav-empty { padding: 120rpx 40rpx; text-align: center; }
.fav-empty .hint { margin: 28rpx 0 40rpx; }
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 20rpx; padding: 68rpx 32rpx; text-align: center; }
.es-ic { width: 84rpx; height: 84rpx; border-radius: var(--radius-md); background: var(--surface-2); color: var(--fg-2); display: flex; align-items: center; justify-content: center; }
.es-ic .iconfont { font-size: 40rpx; }
.es-text { font-size: 26rpx; color: var(--fg-2); }
.delete-bar { flex: 0 0 auto; padding: 24rpx 28rpx calc(24rpx + env(safe-area-inset-bottom)); background: var(--bg); border-top: 1rpx solid var(--border-soft); display: flex; gap: 20rpx; }
.delete-bar-btn, .delete-btn-sm { flex: 1; min-width: 0; }
.delete-bar-btn { display: inline-flex; align-items: center; justify-content: center; padding: 0 28rpx; }
.delete-btn-sm { display: inline-flex; align-items: center; justify-content: center; gap: 8rpx; padding: 0 28rpx; }
.sheet-head { display: flex; flex-direction: column; gap: 8rpx; }
.grab { width: 80rpx; height: 8rpx; border-radius: 4rpx; background: var(--border); margin: 0 auto 20rpx; }
.sheet-title { font-size: 34rpx; font-weight: 600; }
.sheet-desc { font-size: 26rpx; color: var(--fg-2); line-height: 1.65; margin-top: 12rpx; }
.sheet-action { display: block; flex: 1; }
.pick-actions { display: flex; gap: 24rpx; margin: 36rpx 0 8rpx; }
.pick-btn { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 16rpx; padding: 40rpx 0 36rpx; border-radius: var(--radius-md); background: var(--surface); border: 1rpx solid var(--border-soft); color: var(--fg); font-size: 28rpx; font-weight: 600; transition: all 0.2s var(--ease); }
.pick-hover { background: var(--border-soft); }
.info-form { margin-top: 28rpx; }
.info-field { margin-top: 24rpx; }
.info-label { font-size: 26rpx; color: var(--fg-2); display: block; margin-bottom: 12rpx; }
.info-input { border: 1rpx solid var(--border); background: var(--surface); border-radius: var(--radius-md); height: 84rpx; padding: 0 24rpx; font-size: 28rpx; color: var(--fg); }
.upload-actions { display: flex; flex-direction: column; gap: 28rpx; margin-top: 40rpx; }
.upload-action-btn { display: block; width: 92%; margin-left: auto; margin-right: auto; }
.cat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16rpx; }
.cat-chip { display: flex; align-items: center; justify-content: center; min-height: 76rpx; border-radius: 999rpx; border: 1rpx solid var(--border); background: var(--surface); color: var(--fg-2); font-size: 26rpx; transition: all 0.2s var(--ease); }
.cat-chip.on { background: var(--accent); border-color: var(--accent); color: var(--accent-on); font-weight: 600; box-shadow: 0 4rpx 12rpx rgba(227, 165, 149, 0.25); }
.cat-chip-hover { opacity: 0.85; }
.tpl-garment-list { margin-top: 24rpx; max-height: 600rpx; overflow-y: auto; }
/* V22 */
.content{padding-top:14rpx}.empty-state{padding:90rpx 28rpx;border-radius:22rpx}.es-ic{width:64rpx;height:64rpx;border-radius:18rpx;background:var(--surface-2);display:flex;align-items:center;justify-content:center}.es-text{font-size:25rpx;color:var(--fg-2);text-align:center;line-height:1.5}.delete-bar{padding:12rpx 28rpx calc(12rpx + env(safe-area-inset-bottom));background:rgba(248,244,238,.96);border-top:1rpx solid var(--border-soft)}

\\\\n\n### favorites/index.json\n`\{
  "usingComponents": {
    "nav-bar": "/components/nav-bar/index",
    "record-item": "/components/record-item/index",
    "btn": "/components/btn/index"
  },
  "navigationBarTitleText": "收藏"
}

\\\\n\n
---\n\n## 页面: profile\n\n### profile/index.js\n`\const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: { quota: { dailyFree: 0, used: 0, remaining: 0 }, quotaPercent: 0, historyCount: 0, user: { nickname: "微信用户" }, avatarReady: false, personImage: "" },

  loadAvatarState() {
    return api.getAvatarProfile().then((profile) => {
      if (!profile || !profile.id) throw new Error("NO_PROFILE");
      return api.getPersonAsset(profile.id);
    }).then((asset) => {
      const avatarReady = !!asset && !!asset.original_photo;
      if (avatarReady && asset.original_photo && asset.original_photo.indexOf("cloud://") === 0 && wx.cloud && wx.cloud.getTempFileURL) {
        return new Promise(resolve => wx.cloud.getTempFileURL({ fileList:[asset.original_photo], success:r=>resolve((r.fileList&&r.fileList[0]&&r.fileList[0].tempFileURL)||asset.original_photo), fail:()=>resolve(asset.original_photo) })).then(personImage => this.setData({ avatarReady, personImage }));
      }
      this.setData({ avatarReady, personImage: avatarReady ? asset.original_photo : "" });
    }).catch(() => {
      this.setData({ avatarReady: false, personImage: "" });
    });
  },

  onLoad() {
    api.getQuota().then((quota) => {
      const used = quota.used || 0;
      const dailyFree = quota.dailyFree || 0;
      const remaining = Math.max(0, dailyFree - used);
      const quotaPercent = dailyFree > 0 ? Math.min(100, Math.round(used / dailyFree * 100)) : 0;
      this.setData({ quota: Object.assign({}, quota, { used, remaining }), quotaPercent });
    }).catch(() => {});

    // 试穿记录数动态获取（原为硬编码 12）
    api.getHistory().then((records) => {
      this.setData({ historyCount: (records || []).length });
    }).catch(() => this.setData({ historyCount: 0 }));

    this.loadAvatarState();
  },

  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2, navMode: false, pill: true });
    }
    api.getQuota().then((quota) => {
      const used = quota.used || 0, dailyFree = quota.dailyFree || 0;
      const remaining = Math.max(0, dailyFree - used);
      const quotaPercent = dailyFree > 0 ? Math.min(100, Math.round(used / dailyFree * 100)) : 0;
      this.setData({ quota: Object.assign({}, quota, { used, remaining }), quotaPercent });
    }).catch(() => {});
    api.getHistory().then(records => this.setData({ historyCount: (records || []).length })).catch(() => {});
    this.loadAvatarState();
  },

  onSettings() { navigate("/pages/account/index"); },
  onQuota() { toast("今日剩余 " + this.data.quota.remaining + " 次免费试穿"); },
  goAccount() { navigate("/pages/account/index"); },
  goAvatar() { navigate("/pages/avatar-3d/index"); },
  goHistory() { navigate("/pages/history/index"); },
  goPrivacy() { navigate("/pages/privacy-manage/index"); },
  goFeedback() { navigate("/pages/feedback-about/index"); }
});

\\\\n\n### profile/index.wxml\n`\<view class="wx-page">
  <nav-bar title="我的">
    <view slot="right" class="nav-btn" hover-class="nav-btn-hover" bindtap="onSettings">
      <image class="ic-img" style="width:42rpx;height:42rpx" src="/assets/icons/png/icon-settings-dark.png" />
    </view>
  </nav-bar>

  <view class="content">
    <view class="profile-head" hover-class="profile-hover" bindtap="goAccount">
      <view class="profile-avatar"><image wx:if="{{personImage}}" src="{{personImage}}" mode="aspectFill"/><text wx:else>我</text></view>
      <view class="profile-copy">
        <view class="profile-name">{{user.nickname}}</view>
        <view class="profile-sub">{{avatarReady ? '人物基准已建立 · 今天想怎么穿？' : '还没有建立人物基准 · 先添加真实人物照片'}}</view>
      </view>
      <image class="ic-img arrow" style="width:28rpx;height:28rpx" src="/assets/icons/png/icon-chevron-right-gray.png" />
    </view>

    <view class="quota-pill">
      <image class="ic-img" style="width:28rpx;height:28rpx" src="/assets/icons/png/icon-star-deep.png" />
      今日剩余 <text class="mono">{{quota.remaining}}</text> 次免费试穿
    </view>

    <view class="row-list mt-16">
      <view class="row" hover-class="row-hover" bindtap="goAvatar">
        <view class="ri-ic"><image class="ic-img" style="width:38rpx;height:38rpx" src="/assets/icons/png/icon-avatar-deep.png" /></view>
        <view class="ri-main">
          <view class="ri-title">我的人物</view>
          <view class="ri-sub">{{avatarReady ? '查看与编辑你的穿衣基准' : '建立你的穿衣基准'}}</view>
        </view>
        <view class="ri-end"><image class="ic-img" style="width:28rpx;height:28rpx" src="/assets/icons/png/icon-chevron-right-gray.png" /></view>
      </view>

      <view class="row" hover-class="row-hover" bindtap="goHistory">
        <view class="ri-ic"><image class="ic-img" style="width:38rpx;height:38rpx" src="/assets/icons/png/icon-photo-deep.png" /></view>
        <view class="ri-main"><view class="ri-title">试穿记录</view><view class="ri-sub">真实试穿记录</view></view>
        <view class="ri-end"><view class="ri-badge">{{historyCount}}</view><image class="ic-img" style="width:28rpx;height:28rpx" src="/assets/icons/png/icon-chevron-right-gray.png" /></view>
      </view>

      <view class="row" hover-class="row-hover" bindtap="onQuota">
        <view class="ri-ic"><image class="ic-img" style="width:28rpx;height:28rpx" src="/assets/icons/png/icon-star-deep.png" /></view>
        <view class="ri-main"><view class="ri-title">今日剩余次数</view><view class="ri-sub">每日 0 点重置 · 失败自动退回</view></view>
        <view class="ri-end">剩余 {{quota.remaining}} 次<image class="ic-img" style="width:28rpx;height:28rpx" src="/assets/icons/png/icon-chevron-right-gray.png" /></view>
      </view>

      <view class="row" hover-class="row-hover" bindtap="goPrivacy">
        <view class="ri-ic neu"><image class="ic-img" style="width:38rpx;height:38rpx" src="/assets/icons/png/icon-shield-check-gray.png" /></view>
        <view class="ri-main"><view class="ri-title">隐私与数据管理</view><view class="ri-sub">查看已授权数据与删除</view></view>
        <view class="ri-end"><image class="ic-img" style="width:28rpx;height:28rpx" src="/assets/icons/png/icon-chevron-right-gray.png" /></view>
      </view>

      <view class="row" hover-class="row-hover" bindtap="goFeedback">
        <view class="ri-ic neu"><image class="ic-img" style="width:38rpx;height:38rpx" src="/assets/icons/png/icon-feedback-gray.png" /></view>
        <view class="ri-main"><view class="ri-title">意见反馈</view><view class="ri-sub">帮助我们把产品做得更好</view></view>
        <view class="ri-end"><image class="ic-img" style="width:28rpx;height:28rpx" src="/assets/icons/png/icon-chevron-right-gray.png" /></view>
      </view>
    </view>

    <view class="card quota-note">
      <view class="quota-head">
        <text class="hint">今日额度使用</text>
        <text class="mono quota-num">{{quota.used}} / {{quota.dailyFree}}</text>
      </view>
      <view class="quota-meter"><view class="quota-fill" style="width: {{quotaPercent}}%"></view></view>
    </view>
  </view>
</view>

\\\\n\n### profile/index.wxss\n`\.wx-page { height: 100vh; display: flex; flex-direction: column; background: var(--bg); overflow: hidden; padding-bottom: calc(var(--tabbar-h) + env(safe-area-inset-bottom)); }
.nav-btn { width: 80rpx; height: 80rpx; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); color: var(--fg); transition: background 0.15s ease; }
.nav-btn-hover { background: var(--surface-2); }
.nav-btn .iconfont { font-size: 42rpx; }
.profile-head { display: flex; align-items: center; gap: 28rpx; padding: 36rpx 24rpx 40rpx; border-radius: var(--radius-md); transition: background 0.15s ease; }
.profile-hover { background: var(--surface-2); }
.profile-head .arrow { margin-left: auto; }
.profile-avatar { flex: 0 0 128rpx; width: 128rpx; height: 128rpx; border-radius: 50%; background: linear-gradient(135deg, var(--accent) 0%, var(--accent-tab) 100%); color: var(--accent-on); font-size: 48rpx; font-weight: 700; display: flex; align-items: center; justify-content: center; box-shadow: 0 6rpx 20rpx rgba(227, 165, 149, 0.30); }
.profile-copy { flex: 1; min-width: 0; }
.profile-name { font-size: 40rpx; font-weight: 700; }
.profile-sub { font-size: 27rpx; color: var(--fg-2); margin-top: 10rpx; }
.quota-pill { display: inline-flex; align-items: center; gap: 12rpx; background: var(--accent-soft); color: var(--accent-deep); border-radius: 999rpx; padding: 14rpx 28rpx; font-size: 26rpx; font-weight: 600; margin-top: 28rpx; }
.quota-pill .iconfont { font-size: 28rpx; }
.mt-16 { margin-top: 32rpx; }
.quota-note { margin-top: 36rpx; padding: 28rpx 36rpx; }
.quota-head { display: flex; justify-content: space-between; align-items: baseline; }
.hint { font-size: 26rpx; color: var(--fg-2); }
.quota-num { font-size: 28rpx; font-weight: 600; }
.quota-meter { height: 16rpx; border-radius: 8rpx; background: var(--surface-2); overflow: hidden; margin-top: 20rpx; }
.quota-fill { display: block; height: 100%; width: 33%; background: linear-gradient(90deg, var(--accent) 0%, var(--accent-deep) 100%); border-radius: 8rpx; transition: width 0.3s var(--ease); }
.profile-avatar{overflow:hidden}.profile-avatar image{width:100%;height:100%}.profile-avatar text{display:flex;width:100%;height:100%;align-items:center;justify-content:center}
/* V22 */
.profile-head{padding:24rpx 0 20rpx;gap:18rpx}.profile-avatar{width:104rpx;height:104rpx;flex-basis:104rpx;font-size:40rpx}.profile-name{font-size:34rpx}.profile-sub{font-size:23rpx}.quota-pill{margin-top:8rpx;padding:11rpx 18rpx;font-size:24rpx;border-radius:14rpx}.row-list{border-radius:22rpx}.mt-16{margin-top:18rpx}.quota-note{margin-top:18rpx;padding:22rpx;border-radius:22rpx}.quota-meter{height:12rpx;margin-top:14rpx}

\\\\n\n### profile/index.json\n`\{
  "usingComponents": { "nav-bar": "/components/nav-bar/index" },
  "navigationBarTitleText": "我的"
}

\\\\n\n
---\n\n## 页面: garment-add\n\n### garment-add/index.js\n`\const { toast, navigateBack } = require("../../utils/interaction");
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

\\\\n\n### garment-add/index.wxml\n`\<view class="wx-page">
  <nav-bar title="添加衣物" showBack="{{true}}"></nav-bar>
  <view class="content">
    <view class="intro"><text class="title">把衣服放进衣橱</text><text class="sub">保存后不会自动开始试穿。你可以之后随时选择它试穿。</text></view>
    <view class="photo-card" bindtap="pickPhoto"><image wx:if="{{tempPath}}" src="{{tempPath}}" mode="aspectFit"/><view wx:else class="photo-empty"><image src="/assets/icons/png/icon-upload-gray.png" style="width:48rpx;height:48rpx"/><text>添加衣物照片</text><text class="small">建议单件、平铺、背景干净</text></view></view>
    <view class="photo-actions"><view bindtap="pickAlbum"><image src="/assets/icons/png/icon-photo-deep.png" />从相册选择</view><view bindtap="pickCamera"><image src="/assets/icons/png/icon-camera-deep.png" />拍照</view></view>
    <view class="form-card">
      <view class="field"><text class="label">衣物名称</text><input class="input" placeholder="例如：米色交叉上衣" maxlength="30" value="{{name}}" bindinput="onName" /></view>
      <view class="field"><text class="label">分类</text><view class="chips"><view wx:for="{{categories}}" wx:key="*this" class="chip {{item===category?'on':''}}" data-cat="{{item}}" bindtap="onCategory">{{item}}</view></view></view>
      <view class="field"><text class="label">尺码 <text class="optional">选填</text></text><input class="input" placeholder="例如：M" value="{{sizeLabel}}" bindinput="onSize" /></view>
      <view class="field" wx:if="{{category==='上衣'}}"><text class="label">衣物尺寸 <text class="optional">都可选填，不确定就留空</text></text><view class="measure-grid"><input class="input" placeholder="衣长 cm" data-field="lengthCm" bindinput="onInput"/><input class="input" placeholder="胸宽 cm" data-field="chestWidthCm" bindinput="onInput"/><input class="input" placeholder="肩宽 cm" data-field="shoulderWidthCm" bindinput="onInput"/><input class="input" placeholder="袖长 cm" data-field="sleeveLengthCm" bindinput="onInput"/></view></view>
    </view>
  </view>
  <view class="footer-bar"><btn class="footer-main" type="primary" loading="{{uploading}}" bindtap="submit"><image class="btn-icon btn-icon-white" src="/assets/icons/png/icon-save-gray.png" />保存衣物</btn></view>
</view>

\\\\n\n### garment-add/index.wxss\n`\.wx-page{height:100vh;display:flex;flex-direction:column;background:var(--bg);overflow:hidden}.content{flex:1;min-height:0;overflow-y:auto;padding:8rpx 24rpx 48rpx}.intro{padding:26rpx 4rpx 24rpx}.intro .title{display:block;font-size:38rpx;font-weight:700}.intro .sub{display:block;margin-top:10rpx;color:var(--muted);font-size:26rpx;line-height:1.6}.photo-card{height:520rpx;border-radius:var(--radius-lg);background:var(--surface);border:1rpx solid var(--border-soft);overflow:hidden;box-shadow:var(--shadow-card)}.photo-card>image{width:100%;height:100%}.photo-empty{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14rpx;color:var(--fg-2)}.photo-empty .small{font-size:24rpx;color:var(--muted)}.photo-actions{display:flex;gap:16rpx;margin:16rpx 0 8rpx}.photo-actions view{flex:1;text-align:center;padding:20rpx;background:var(--surface);border:1rpx solid var(--border);border-radius:var(--radius-md);font-size:27rpx}.form-card{margin-top:24rpx;padding:8rpx 28rpx 30rpx;background:var(--surface);border-radius:var(--radius-lg);border:1rpx solid var(--border-soft)}.field{margin-top:28rpx}.label{display:block;font-size:27rpx;color:var(--fg-2);margin-bottom:12rpx}.optional{font-size:23rpx;color:var(--muted)}.input{height:82rpx;border:1rpx solid var(--border);border-radius:var(--radius-md);padding:0 22rpx;background:var(--surface);font-size:28rpx}.chips{display:flex;gap:12rpx}.chip{flex:1;text-align:center;padding:20rpx;border-radius:999rpx;border:1rpx solid var(--border);color:var(--fg-2);font-size:27rpx}.chip.on{background:var(--accent);border-color:var(--accent);color:#fff}.measure-grid{display:grid;grid-template-columns:1fr 1fr;gap:14rpx}
/* V22 */
.intro{padding:22rpx 0 18rpx}.intro .title{font-size:34rpx}.intro .sub{font-size:24rpx}.photo-card{height:460rpx;border-radius:22rpx;box-shadow:none}.photo-actions{gap:10rpx;margin:10rpx 0}.photo-actions view{padding:15rpx;border-radius:16rpx;font-size:25rpx}.form-card{margin-top:18rpx;padding:4rpx 22rpx 26rpx;border-radius:22rpx;box-shadow:none}.field{margin-top:24rpx}.input{height:76rpx;border-radius:16rpx}.chip{padding:16rpx;border-radius:16rpx;font-size:25rpx}
.photo-actions view{display:flex;align-items:center;justify-content:center;gap:8rpx}.photo-actions image{width:28rpx;height:28rpx;opacity:.72}

\\\\n\n### garment-add/index.json\n`\{"navigationBarTitleText": "添加衣物"}
\\\\n\n
---\n\n## 页面: garment-detail\n\n### garment-detail/index.js\n`\const { toast, navigate, showModal } = require("../../utils/interaction");
const api = require("../../utils/api");
Page({data:{garment:null,editing:false,name:"",sizeLabel:""},onLoad(q){if(!q||!q.id)return toast("衣物参数错误");this.id=q.id;this.load();},load(){api.getMyGarments().then(list=>{const g=(list||[]).find(x=>x.id===this.id);if(!g)return this.setData({garment:null});this.setData({garment:g,name:g.name||"",sizeLabel:g.size_label||""});}).catch(()=>toast("衣物加载失败，请重试"));},toggleEdit(){this.setData({editing:!this.data.editing});},onName(e){this.setData({name:e.detail.value});},onSize(e){this.setData({sizeLabel:e.detail.value});},save(){if(!this.data.name.trim())return toast("请输入衣物名称");api.updateGarment(this.id,{name:this.data.name.trim(),size_label:this.data.sizeLabel.trim()||null}).then(()=>{toast("已保存");this.setData({editing:false});this.load();}).catch(()=>toast("保存失败，请重试"));},onDelete(){showModal({title:"删除衣物",content:"删除后不可恢复，确定继续吗？",confirmText:"删除",confirmColor:"#C0392B"}).then(r=>{if(!r.confirm)return;api.deleteMyGarments([this.id]).then(()=>{toast("已删除");setTimeout(()=>wx.navigateBack(),400);}).catch(()=>toast("删除失败，请重试"));});},onTryon(){const g=this.data.garment;wx.setStorageSync("aiTryonPending",{garmentId:g.id,garmentIds:[g.id],garmentNames:[g.name],garmentImages:[g.image],garmentCategories:[g.category||"上衣"],displayName:g.name});navigate("/pages/tryon-select/index");}});

\\\\n\n### garment-detail/index.wxml\n`\<view class="wx-page"><nav-bar title="衣物详情" showBack="{{true}}"></nav-bar><view class="content" wx:if="{{garment}}"><view class="photo-card"><image src="{{garment.image}}" mode="aspectFit"/></view><view class="title-row"><view><text class="title">{{garment.name}}</text><text class="meta">{{garment.category}}<text wx:if="{{garment.size_label}}"> · {{garment.size_label}}</text></text></view></view><view class="info-card"><view class="info-title">衣物信息</view><view class="info-row"><text>分类</text><text>{{garment.category}}</text></view><view class="info-row"><text>尺码</text><text>{{garment.size_label || '未填写'}}</text></view><view class="info-row" wx:if="{{garment.measurements.lengthCm}}"><text>衣长</text><text>{{garment.measurements.lengthCm}} cm</text></view><view class="info-row" wx:if="{{garment.measurements.chestWidthCm}}"><text>胸宽</text><text>{{garment.measurements.chestWidthCm}} cm</text></view><view class="info-row" wx:if="{{garment.measurements.shoulderWidthCm}}"><text>肩宽</text><text>{{garment.measurements.shoulderWidthCm}} cm</text></view><view class="info-row" wx:if="{{garment.measurements.sleeveLengthCm}}"><text>袖长</text><text>{{garment.measurements.sleeveLengthCm}} cm</text></view></view><view class="actions"><btn type="primary" bindtap="onTryon"><image class="btn-icon btn-icon-white" src="/assets/icons/png/icon-hanger-white.png" />试穿这件</btn><btn type="secondary" bindtap="toggleEdit"><image class="btn-icon" src="/assets/icons/png/icon-settings-dark.png" />编辑衣物</btn><btn type="secondary" bindtap="onDelete"><image class="btn-icon" src="/assets/icons/png/icon-trash-white.png" />删除衣物</btn></view><view wx:if="{{editing}}" class="edit-card"><view class="field"><text>名称</text><input class="input" value="{{name}}" bindinput="onName"/></view><view class="field"><text>尺码</text><input class="input" value="{{sizeLabel}}" bindinput="onSize"/></view><view class="edit-actions"><btn type="primary" bindtap="save">保存修改</btn><btn type="secondary" bindtap="toggleEdit">取消</btn></view></view></view><view wx:else class="empty">衣物不存在或已删除</view></view>

\\\\n\n### garment-detail/index.wxss\n`\.wx-page{height:100vh;display:flex;flex-direction:column;background:var(--bg);overflow:hidden}.content{flex:1;min-height:0;overflow-y:auto;padding:8rpx 24rpx 48rpx}.photo-card{height:650rpx;border-radius:var(--radius-lg);overflow:hidden;background:var(--surface);border:1rpx solid var(--border-soft);box-shadow:var(--shadow-raise)}.photo-card image{width:100%;height:100%}.title-row{padding:28rpx 4rpx 12rpx}.title{display:block;font-size:38rpx;font-weight:700}.meta{display:block;color:var(--muted);font-size:26rpx;margin-top:8rpx}.info-card,.edit-card{margin-top:22rpx;padding:24rpx 28rpx;background:var(--surface);border:1rpx solid var(--border-soft);border-radius:var(--radius-lg)}.info-title{font-size:30rpx;font-weight:600;margin-bottom:14rpx}.info-row{display:flex;justify-content:space-between;padding:18rpx 0;border-top:1rpx solid var(--border-soft);font-size:27rpx}.info-row text:first-child{color:var(--muted)}.actions{display:flex;flex-direction:column;gap:16rpx;margin-top:28rpx}.field{margin-top:18rpx}.field>text{display:block;margin-bottom:10rpx;color:var(--fg-2);font-size:27rpx}.input{height:82rpx;border:1rpx solid var(--border);border-radius:var(--radius-md);padding:0 20rpx}.edit-actions{display:flex;gap:14rpx;margin-top:22rpx}.edit-actions .btn{flex:1}.empty{text-align:center;padding:160rpx 30rpx;color:var(--muted)}
/* V22 */
.photo-card{height:590rpx;border-radius:22rpx;box-shadow:none}.title-row{padding:22rpx 2rpx 8rpx}.title{font-size:34rpx}.meta{font-size:24rpx}.info-card,.edit-card{border-radius:22rpx;box-shadow:none;padding:20rpx 22rpx}.info-title{font-size:28rpx}.info-row{font-size:25rpx;padding:15rpx 0}.actions{gap:10rpx}

\\\\n\n### garment-detail/index.json\n`\{"navigationBarTitleText": "衣物详情"}
\\\\n\n
---\n\n## 页面: basic-info\n\n### basic-info/index.js\n`\const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");
Page({data:{genderOptions:[{label:"女性",value:"female"},{label:"男性",value:"male"}],gender:"",height:"",weight:"",bust:"",waist:"",hip:""},onLoad(){api.getAvatarProfile().then(p=>{if(!p||p.isExample)return;this.setData({gender:p.gender||"",height:p.heightCm!=null?String(p.heightCm):"",weight:p.weightKg!=null?String(p.weightKg):"",bust:p.bustCm!=null?String(p.bustCm):"",waist:p.waistCm!=null?String(p.waistCm):"",hip:p.hipCm!=null?String(p.hipCm):""});}).catch(()=>{});},onGender(e){this.setData({gender:e.detail.value});},onHeight(e){this.setData({height:e.detail.value});},onWeight(e){this.setData({weight:e.detail.value});},onBust(e){this.setData({bust:e.detail.value});},onWaist(e){this.setData({waist:e.detail.value});},onHip(e){this.setData({hip:e.detail.value});},next(){const d=this.data;if(!d.gender||!d.height||!d.weight)return toast("请先填写性别、身高和体重");const n=v=>{const x=parseFloat(v);return Number.isFinite(x)?x:null;};api.saveAvatarProfile({gender:d.gender,heightCm:n(d.height),weightKg:n(d.weight),bustCm:n(d.bust),waistCm:n(d.waist),hipCm:n(d.hip)}).then(()=>navigate("/pages/photo-upload/index")).catch(e=>{console.error("[basic-info] save failed",e);toast((e&&e.message)||"保存失败，请重试");});}});

\\\\n\n### basic-info/index.wxml\n`\<view class="wx-page"><nav-bar title="人物资料" showBack="{{true}}"></nav-bar><view class="content"><view class="intro"><text class="title">先告诉我你的身形</text><text class="sub">只填写你确认过的数据。不会填写的项目可以留空，之后也能修改。</text></view><view class="form-card"><view class="field"><text class="label">性别</text><seg options="{{genderOptions}}" value="{{gender}}" bindchange="onGender"></seg></view><view class="field"><text class="label">身高 <text class="required">必填</text></text><view class="input-unit"><input type="digit" value="{{height}}" placeholder="例如 170" bindinput="onHeight"/><text>cm</text></view></view><view class="field"><text class="label">体重 <text class="required">必填</text></text><view class="input-unit"><input type="digit" value="{{weight}}" placeholder="例如 60" bindinput="onWeight"/><text>kg</text></view></view></view><view class="section-head"><text>更多身形数据</text><text>选填</text></view><view class="measure-grid"><view class="measure-card"><text>胸围</text><view><input type="digit" value="{{bust}}" bindinput="onBust" placeholder="—"/><text>cm</text></view></view><view class="measure-card"><text>腰围</text><view><input type="digit" value="{{waist}}" bindinput="onWaist" placeholder="—"/><text>cm</text></view></view><view class="measure-card"><text>臀围</text><view><input type="digit" value="{{hip}}" bindinput="onHip" placeholder="—"/><text>cm</text></view></view></view></view><view class="footer-bar"><btn class="footer-main" type="primary" bindtap="next"><image class="btn-icon btn-icon-white" src="/assets/icons/png/icon-chevron-right-gray.png" />继续添加人物照片</btn></view></view>

\\\\n\n### basic-info/index.wxss\n`\.wx-page{height:100vh;display:flex;flex-direction:column;background:var(--bg);overflow:hidden}.content{flex:1;min-height:0;overflow-y:auto;padding:8rpx 24rpx 48rpx}.intro{padding:26rpx 4rpx}.intro .title{display:block;font-size:38rpx;font-weight:700}.intro .sub{display:block;margin-top:10rpx;font-size:26rpx;color:var(--muted);line-height:1.65}.form-card{background:var(--surface);border:1rpx solid var(--border-soft);border-radius:var(--radius-lg);padding:6rpx 28rpx 30rpx}.field{margin-top:28rpx}.label{display:block;font-size:27rpx;color:var(--fg-2);margin-bottom:12rpx}.required{font-size:23rpx;color:var(--accent-text)}.input-unit{display:flex;align-items:center;border:1rpx solid var(--border);border-radius:var(--radius-md);height:86rpx;padding:0 22rpx}.input-unit input{flex:1;font-size:30rpx}.input-unit text{color:var(--muted);font-size:26rpx}.section-head{display:flex;justify-content:space-between;align-items:baseline;margin:36rpx 4rpx 16rpx;font-size:31rpx;font-weight:600}.section-head text:last-child{font-size:24rpx;color:var(--muted);font-weight:400}.measure-grid{display:grid;grid-template-columns:1fr 1fr;gap:14rpx}.measure-card{padding:20rpx;background:var(--surface);border:1rpx solid var(--border-soft);border-radius:var(--radius-md)}.measure-card>text{font-size:25rpx;color:var(--fg-2)}.measure-card>view{display:flex;align-items:center;margin-top:12rpx}.measure-card input{flex:1;font-size:28rpx}.measure-card>view>text{font-size:23rpx;color:var(--muted)}
/* V22 */
.intro{padding:22rpx 0}.intro .title{font-size:34rpx}.intro .sub{font-size:24rpx}.form-card{padding:4rpx 22rpx 24rpx;border-radius:22rpx;box-shadow:none}.field{margin-top:24rpx}.label{font-size:25rpx}.input-unit{height:78rpx;border-radius:16rpx}.input-unit input{font-size:29rpx}.measure-card{padding:17rpx;border-radius:16rpx}.measure-card>text{font-size:23rpx}

\\\\n\n### basic-info/index.json\n`\{
  "usingComponents": {
    "nav-bar": "/components/nav-bar/index",
    "btn": "/components/btn/index",
    "card": "/components/card/index",
    "seg": "/components/seg/index",
    "tab-bar": "/components/tabbar/index"
  },
  "navigationBarTitleText": "基本信息"
}

\\\\n\n
---\n\n## 页面: photo-upload\n\n### photo-upload/index.js\n`\const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

const DRAFT_KEY = "avatarPhotoDraft";
const DRAFT_TTL = 30 * 60 * 1000;

function readDraft() {
  const draft = wx.getStorageSync(DRAFT_KEY) || {};
  if (draft.updatedAt && Date.now() - draft.updatedAt > DRAFT_TTL) {
    wx.removeStorageSync(DRAFT_KEY);
    return {};
  }
  return draft;
}

Page({
  data: {
    faceState: "none",
    bodyState: "none",
    bodyReady: false,
    sheetVisible: false
  },

  onLoad() {
    const draft = readDraft();

    api.getAvatarProfile().then((profile) => {
      if (!profile) return;

      const facePhoto = profile.face_photo_id || profile.facePhoto || "";
      const bodyPhoto = profile.body_photo_id || profile.bodyPhoto || "";

      this._existingFacePhoto = facePhoto;
      this._existingBodyPhoto = bodyPhoto;

      const nextDraft = Object.assign({}, readDraft(), {
        existingFacePhoto: facePhoto,
        existingBodyPhoto: bodyPhoto,
        updatedAt: Date.now()
      });

      wx.setStorageSync(DRAFT_KEY, nextDraft);

      this.setData({
        faceState: draft.faceTempPath || facePhoto ? "done" : "none",
        bodyState: draft.bodyTempPath || bodyPhoto ? "done" : "none",
        bodyReady: !!(draft.bodyTempPath || bodyPhoto)
      });
    }).catch(() => {
      this.setData({
        faceState: draft.faceTempPath ? "done" : "none",
        bodyState: draft.bodyTempPath ? "done" : "none",
        bodyReady: !!draft.bodyTempPath
      });
    });
  },

  openFaceSheet() {
    this._photoTarget = "face";
    this.setData({ sheetVisible: true });
  },

  openBodySheet() {
    this._photoTarget = "body";
    this.setData({ sheetVisible: true });
  },

  closePhotoSheet() {
    this.setData({ sheetVisible: false });
  },

  choosePhoto(e) {
    const target = this._photoTarget || "face";
    const sourceType = e.currentTarget.dataset.mode === "camera"
      ? ["camera"]
      : ["album"];

    if (this._choosingPhoto) return;

    this._choosingPhoto = true;
    this.setData({ sheetVisible: false });
    wx.showLoading({ title: "读取中", mask: true });

    new Promise((resolve, reject) => {
      wx.chooseMedia({
        count: 1,
        mediaType: ["image"],
        sourceType,
        success: resolve,
        fail: reject
      });
    })
      .then((res) => {
        const f = res.tempFiles && res.tempFiles[0];

        if (!f || !f.tempFilePath) {
          throw new Error("未选择照片");
        }

        if (f.size && f.size > 5 * 1024 * 1024) {
          throw new Error("照片大小不能超过5MB");
        }

        const draft = Object.assign({}, readDraft(), {
          updatedAt: Date.now()
        });

        if (target === "face") {
          draft.faceTempPath = f.tempFilePath;
          draft.facePhoto = "";
          this.setData({ faceState: "done" });
        } else {
          draft.bodyTempPath = f.tempFilePath;
          draft.bodyPhoto = "";
          this.setData({ bodyState: "done", bodyReady: true });
        }

        wx.setStorageSync(DRAFT_KEY, draft);
        toast("照片已选择");
      })
      .catch((err) => {
        if (err && err.errMsg && /cancel/i.test(err.errMsg)) return;

        toast(
          (err && err.message) || "照片选择失败，请重试",
          2400
        );
      })
      .finally(() => {
        this._choosingPhoto = false;
        wx.hideLoading();
      });
  },

  generate() {
    const draft = Object.assign({}, readDraft(), {
      existingFacePhoto: this._existingFacePhoto || "",
      existingBodyPhoto: this._existingBodyPhoto || "",
      updatedAt: Date.now()
    });

    const hasBodyPhoto = !!(draft.bodyTempPath || draft.existingBodyPhoto);
    if (!hasBodyPhoto) {
      toast("请先添加一张适合作为试穿基准的正面全身照");
      return;
    }

    wx.setStorageSync(DRAFT_KEY, draft);
    navigate("/pages/privacy-auth/index");
  }
});

\\\\n\n### photo-upload/index.wxml\n`\<view class="wx-page">
  <nav-bar title="人物照片" showBack="{{true}}"></nav-bar>

  <view class="content">
    <view class="subtitle">一张正面全身照是 V1 试穿的人物基准；人脸照可作为辅助。</view>

    <upload-card
      title="人脸辅助照"
      desc="正面照、光线均匀 · jpg/png ≤ 5MB"
      icon="/assets/icons/png/icon-camera-white.png"
      state="{{faceState}}"
      stateText="选填"
      bindtap="openFaceSheet"
    />
    <upload-card
      class="upload-gap"
      title="正面全身照（必填）"
      desc="用于 V1 试穿人物基准 · 正面、完整、光线均匀"
      icon="/assets/icons/png/icon-avatar-white.png"
      state="{{bodyState}}"
      stateText="必填"
      bindtap="openBodySheet"
    />

    <view class="step-note">人物照片将作为 Person Asset 保存，用于 V1 试穿。人脸照片属于敏感个人信息，会在单独授权后存储；中途退出会自动保存草稿。</view>
  </view>

  <view class="footer-bar">
    <btn class="footer-main" type="primary" disabled="{{!bodyReady}}" bindtap="generate"><image wx:if="{{bodyReady}}" class="btn-icon btn-icon-white" src="/assets/icons/png/icon-chevron-right-gray.png" />{{bodyReady ? "继续" : "请先添加正面全身照"}}</btn>
  </view>

  <tab-bar selected="{{0}}" navMode="{{true}}"></tab-bar>

  <sheet visible="{{sheetVisible}}" bind:cancel="closePhotoSheet">
    <view class="sheet-head">
      <view class="grab"></view>
      <text class="sheet-title">选择照片</text>
      <text class="sheet-desc">建议正面、完整、光线均匀；jpg / png ≤ 5MB。人物照片仅用于建立人物资产与试穿。</text>
    </view>
    <view class="s-rows">
      <view class="s-row" hover-class="row-hover" data-mode="album" bindtap="choosePhoto">从相册选择</view>
      <view class="s-row" hover-class="row-hover" data-mode="camera" bindtap="choosePhoto">拍照</view>
    </view>
  </sheet>
</view>

\\\\n\n### photo-upload/index.wxss\n`\.wx-page { height: 100vh; display: flex; flex-direction: column; background: var(--bg); overflow: hidden; }
.nav-btn { width: 80rpx; height: 80rpx; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); color: var(--fg); transition: background 0.15s ease; }
.nav-btn-hover { background: var(--surface-2); }
.nav-btn .iconfont { font-size: 42rpx; }
.content { flex: 1; overflow-y: auto; padding: 8rpx 0 48rpx; }
.sec-title { font-size: 34rpx; font-weight: 600; margin: 40rpx 4rpx 16rpx; }
.hint { font-size: 25rpx; color: var(--fg-2); margin: 0 4rpx 28rpx; line-height: 1.6; }
.upload-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20rpx; }
.upload-hover .upload-card { border-color: var(--accent); box-shadow: var(--shadow-card-hover); }
.upload-card { border-radius: var(--radius-md); overflow: hidden; border: 1rpx solid var(--border-soft); background: var(--surface); box-shadow: var(--shadow-card); transition: all 0.2s var(--ease); }
.upload-card image { width: 100%; height: 280rpx; }
.upload-meta { padding: 16rpx 20rpx 20rpx; }
.upload-name { font-size: 26rpx; font-weight: 600; }
.upload-status { font-size: 22rpx; color: var(--fg-2); margin-top: 6rpx; }
.upload-status.success { color: var(--success); }
.upload-status.error { color: var(--danger); }
.next-btn { display: block; margin-top: 48rpx; width: 100%; }
.next-btn.disabled { opacity: 0.5; }
/* V22 */
.content{padding-left:28rpx;padding-right:28rpx}.sec-title{font-size:32rpx;margin:28rpx 0 12rpx}.hint{font-size:23rpx}.upload-grid{gap:12rpx}.upload-card{border-radius:18rpx;box-shadow:none}.upload-card image{height:250rpx}.upload-meta{padding:12rpx 14rpx 15rpx}.upload-name{font-size:24rpx}.upload-status{font-size:21rpx}.next-btn{margin-top:30rpx}

\\\\n\n### photo-upload/index.json\n`\{
  "usingComponents": {
    "nav-bar": "/components/nav-bar/index",
    "btn": "/components/btn/index",
    "upload-card": "/components/upload-card/index",
    "sheet": "/components/sheet/index",
    "tab-bar": "/components/tabbar/index"
  },
  "navigationBarTitleText": "照片上传"
}

\\\\n\n
---\n\n## 页面: avatar-3d\n\n### avatar-3d/index.js\n`\const api = require("../../utils/api");
const { navigate, toast } = require("../../utils/interaction");

function resolveImage(src) {
  if (!src || src.indexOf("cloud://") !== 0 || !wx.cloud || !wx.cloud.getTempFileURL) {
    return Promise.resolve(src || "");
  }
  return new Promise((resolve) => {
    wx.cloud.getTempFileURL({
      fileList: [src],
      success: (r) => resolve(r.fileList && r.fileList[0] && r.fileList[0].tempFileURL || src),
      fail: () => resolve(src)
    });
  });
}

Page({
  data: {
    asset: null,
    personImage: "",
    faceImage: "",
    profile: { heightCm: "--", weightKg: "--", shoulderCm: "--", bustCm: "--", waistCm: "--", hipCm: "--", legLengthCm: "--" },
    ready: false
  },

  async loadData() {
    try {
      const profile = await api.getAvatarProfile();
      if (!profile || !profile.id) {
        this.setData({ asset: null, ready: false, personImage: "", faceImage: "" });
        return;
      }
      const asset = await api.getPersonAsset(profile.id);
      const original = asset && (asset.original_photo || asset.originalPhoto || "");
      const front = asset && (asset.front_photo || asset.frontPhoto || "");
      const [personImage, faceImage] = await Promise.all([resolveImage(original), resolveImage(front)]);
      this.setData({ profile, asset, personImage, faceImage, ready: !!asset && !!original });
    } catch (e) {
      console.error("[avatar-3d] loadData failed", e);
      toast((e && e.message) || "人物资产读取失败", 2600);
      this.setData({ asset: null, ready: false, personImage: "", faceImage: "" });
    }
  },

  onShow() { this.loadData(); },
  edit() { navigate("/pages/basic-info/index"); },
  updatePhotos() { navigate("/pages/photo-upload/index"); },
  goTryon() {
    if (!this.data.ready) {
      toast("请先添加一张人物照片");
      return;
    }
    navigate("/pages/tryon-select/index");
  },
});

\\\\n\n### avatar-3d/index.wxml\n`\<view class="wx-page">
  <nav-bar title="我的人物" showBack="{{true}}" backRoute="/pages/home/index"></nav-bar>

  <view class="content">
    <view class="avatar-intro">
      <text class="avatar-intro-title">你的穿衣基准</text>
      <text class="avatar-intro-sub">用你自己的真实照片建立人物资产，试穿时优先保持你的脸和身形。</text>
    </view>

    <view class="avatar-stage" wx:if="{{ready}}">
      <image wx:if="{{personImage}}" class="avatar-img" src="{{personImage}}" mode="aspectFit" />
      <view wx:if="{{faceImage}}" class="person-face-chip">
        <image class="person-face-img" src="{{faceImage}}" mode="aspectFill" />
        <text>正面照</text>
      </view>
      <view class="example-tag">真实人物</view>
    </view>

    <view wx:else class="avatar-stage">
      <view class="stage-fallback">
        <text class="fb-text">还没有人物照片</text>
        <btn class="fb-btn" type="secondary" size="sm" bindtap="updatePhotos"><image class="btn-icon" src="/assets/icons/png/icon-photo-deep.png" />添加照片</btn>
      </view>
    </view>


    <view class="sec-hd">
      <text class="sec-title">我的身体资料</text>
      <view class="more" hover-class="more-hover" bindtap="edit">编辑资料<image class="ic-img" style="width:26rpx;height:26rpx" src="/assets/icons/png/icon-chevron-right-gray.png" /></view>
    </view>
    <view class="profile-grid">
      <view class="p-cell"><text class="pc-label">身高</text><text class="pc-val mono">{{profile.heightCm || '—'}}<small>cm</small></text></view>
      <view class="p-cell"><text class="pc-label">体重</text><text class="pc-val mono">{{profile.weightKg || '—'}}<small>kg</small></text></view>
      <view class="p-cell"><text class="pc-label">肩宽</text><text class="pc-val mono">{{profile.shoulderCm || '—'}}<small>cm</small></text></view>
      <view class="p-cell"><text class="pc-label">胸围</text><text class="pc-val mono">{{profile.bustCm || '—'}}<small>cm</small></text></view>
      <view class="p-cell"><text class="pc-label">腰围</text><text class="pc-val mono">{{profile.waistCm || '—'}}<small>cm</small></text></view>
      <view class="p-cell"><text class="pc-label">臀围</text><text class="pc-val mono">{{profile.hipCm || '—'}}<small>cm</small></text></view>
      <view class="p-cell"><text class="pc-label">腿长</text><text class="pc-val mono">{{profile.legLengthCm || '—'}}<small>cm</small></text></view>
      <view class="p-cell"><text class="pc-label">臂长</text><text class="pc-val mono">{{profile.armLengthCm || '—'}}<small>cm</small></text></view>
      <view class="p-cell"><text class="pc-label">颈长</text><text class="pc-val mono">{{profile.neckLengthCm || '—'}}<small>cm</small></text></view>
    </view>
  </view>

  <view class="footer-bar">
    <btn class="footer-main" type="primary" bindtap="goTryon"><image class="btn-icon btn-icon-white" src="/assets/icons/png/icon-hanger-white.png" />去试穿</btn>
    <btn class="footer-sub" type="secondary" bindtap="updatePhotos"><image class="btn-icon" src="/assets/icons/png/icon-photo-deep.png" />更新人物照片</btn>
  </view>
</view>

\\\\n\n### avatar-3d/index.wxss\n`\.wx-page { height: 100vh; display: flex; flex-direction: column; background: var(--bg); overflow: hidden; }
.nav-btn { width: 80rpx; height: 80rpx; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); color: var(--fg); transition: background 0.15s ease; }
.nav-btn-hover { background: var(--surface-2); }
.nav-btn .iconfont { font-size: 42rpx; }
.content { flex: 1; overflow-y: auto; padding: 8rpx 24rpx 48rpx; }
.avatar-preview { width: 100%; height: 560rpx; border-radius: var(--radius-lg); overflow: hidden; border: 1rpx solid var(--border-soft); background: var(--surface); box-shadow: var(--shadow-raise); }
.avatar-preview image { width: 100%; height: 100%; }
.avatar-info { margin-top: 32rpx; text-align: center; }
.avatar-name { font-size: 36rpx; font-weight: 700; }
.avatar-sub { font-size: 25rpx; color: var(--fg-2); margin-top: 12rpx; }
.avatar-actions { margin-top: 40rpx; display: flex; flex-direction: column; gap: 20rpx; }
.avatar-actions .btn { width: 100%; }

.avatar-intro {
  padding: 8rpx 0 28rpx;
}

.avatar-intro-title {
  display: block;
  font-size: 38rpx;
  font-weight: 700;
  color: var(--fg);
  letter-spacing: 0.02em;
}

.avatar-intro-sub {
  display: block;
  font-size: 25rpx;
  color: var(--fg-2);
  line-height: 1.65;
  margin-top: 10rpx;
}

.avatar-stage {
  position: relative;
  width: 100%;
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1rpx solid var(--border-soft);
  background: var(--surface);
  box-shadow: var(--shadow-raise);
}

.avatar-img {
  width: 100%;
  display: block;
}

.stage-fallback {
  min-height: 560rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20rpx;
  background: var(--surface);
}

.fb-text {
  font-size: 27rpx;
  color: var(--fg-2);
}

.fb-btn {
  width: 60%;
}

.example-tag {
  position: absolute;
  top: 20rpx;
  left: 20rpx;
  z-index: 2;
  padding: 7rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(31,29,27,0.58);
  color: #fff;
  font-size: 21rpx;
}

.view-labels {
  display: flex;
  justify-content: space-between;
  padding: 14rpx 44rpx 18rpx;
  color: var(--muted);
  font-size: 23rpx;
}

.meas-hint {
  text-align: center;
  font-size: 24rpx;
  color: var(--muted);
  margin-top: 22rpx;
  line-height: 1.5;
}

.profile-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}

.p-cell {
  padding: 28rpx 12rpx 24rpx;
  text-align: center;
}

.pc-label {
  font-size: 24rpx;
  color: var(--fg-2);
}

.pc-val {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  color: var(--fg);
  margin-top: 10rpx;
}

.pc-val small {
  font-size: 22rpx;
  font-weight: 500;
  color: var(--fg-2);
  margin-left: 2rpx;
}

.footer-main {
  flex: 2;
}

.footer-sub {
  flex: 1;
}
/* V22 */
.avatar-intro{padding:22rpx 0 16rpx}.avatar-intro-title{font-size:34rpx;font-weight:700}.avatar-intro-sub{font-size:24rpx;color:var(--muted);line-height:1.6}.avatar-stage{border-radius:22rpx;box-shadow:none}.example-tag{top:14rpx;left:14rpx}.sec-hd{margin-top:28rpx}.profile-grid{background:var(--surface);border:1rpx solid var(--border-soft);border-radius:22rpx;overflow:hidden}.p-cell{padding:22rpx 8rpx}.pc-label{font-size:22rpx}.pc-val{font-size:30rpx;margin-top:8rpx}.footer-main{flex:1.4}.footer-sub{flex:1}

\\\\n\n### avatar-3d/index.json\n`\{
  "usingComponents": {
    "nav-bar": "/components/nav-bar/index",
    "btn": "/components/btn/index"
  },
  "navigationBarTitleText": "我的人物形象"
}

\\\\n\n
---\n\n## 页面: account\n\n### account/index.js\n`\const { toast, reLaunch } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: { loggedIn: false },
  onShow() {
    const app = getApp();
    this.setData({ loggedIn: !!(app && app.globalData && app.globalData.loggedIn) });
  },
  onLogout() {
    api.logout().then(() => {
      const app = getApp();
      if (app && app.globalData) { app.globalData.loggedIn = false; app.globalData.openid = ""; }
      toast("已退出登录");
      this._logoutTimer = setTimeout(() => reLaunch("/pages/login/index"), 500);
    }).catch((e) => {
      console.error("[account] logout failed", e);
      toast((e && e.message) || "退出失败，请重试");
    });
  },
  onUnload() { if (this._logoutTimer) { clearTimeout(this._logoutTimer); this._logoutTimer = null; } }
});

\\\\n\n### account/index.wxml\n`\<view class="wx-page">
  <nav-bar title="账号" showBack="{{true}}"></nav-bar>
  <view class="content">
    <view class="account-head">
      <view class="account-avatar">我</view>
      <view class="account-info">
        <view class="account-name">微信账号</view>
        <view class="account-id">{{loggedIn ? "已通过微信身份验证" : "当前未登录"}}</view>
      </view>
    </view>
    <view class="row-list">
      <view class="row">
        <view class="ri-ic neu"><image src="/assets/icons/png/icon-user-gray.png" /></view>
        <view class="ri-main"><view class="ri-title">微信身份</view><view class="ri-sub">用于账号归属与数据隔离</view></view>
        <view class="ri-end">{{loggedIn ? "已验证" : "未登录"}}</view>
      </view>
      <view class="row">
        <view class="ri-ic neu"><image src="/assets/icons/png/icon-shield-gray.png" /></view>
        <view class="ri-main"><view class="ri-title">账号数据</view><view class="ri-sub">人物、衣物、试穿记录按当前微信身份隔离</view></view>
      </view>
    </view>
    <view class="hint mt-32">V1 不在账号页虚构手机号、个人 ID 或第三方绑定状态。</view>
    <btn class="logout-btn" type="danger" bindtap="onLogout"><image class="btn-icon btn-icon-white" src="/assets/icons/png/icon-user-gray.png" />退出登录</btn>
  </view>
  <tab-bar selected="{{2}}" navMode="{{true}}" pill="{{true}}"></tab-bar>
</view>

\\\\n\n### account/index.wxss\n`\.wx-page { height: 100vh; display: flex; flex-direction: column; background: var(--bg); overflow: hidden; }
.nav-btn { width: 80rpx; height: 80rpx; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); color: var(--fg); transition: background 0.15s ease; }
.nav-btn-hover { background: var(--surface-2); }
.nav-btn .iconfont { font-size: 42rpx; }
.content { flex: 1; overflow-y: auto; padding: 8rpx 24rpx 48rpx; }
.avatar-card { padding: 40rpx 36rpx; display: flex; flex-direction: column; align-items: center; gap: 20rpx; text-align: center; }
.avatar-circle { width: 160rpx; height: 160rpx; border-radius: 50%; background: linear-gradient(135deg, var(--accent) 0%, var(--accent-tab) 100%); color: var(--accent-on); font-size: 56rpx; font-weight: 700; display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 28rpx rgba(227, 165, 149, 0.35); }
.avatar-name { font-size: 36rpx; font-weight: 700; }
.avatar-sub { font-size: 26rpx; color: var(--fg-2); }
.avatar-tags { display: flex; gap: 12rpx; flex-wrap: wrap; justify-content: center; }
.avatar-tag { font-size: 25rpx; padding: 8rpx 20rpx; border-radius: 999rpx; background: var(--surface-2); color: var(--fg-2); font-weight: 500; }
.avatar-tag.name { background: var(--accent-soft); color: var(--accent-deep); }
.avatar-tag.wechat { background: #E8F5E9; color: #2E7D32; }
.avatar-tag.machine { background: #E3F2FD; color: #1565C0; }
.row { padding: 32rpx 0; }
.row-hover { opacity: 0.85; }
.row-title { font-size: 30rpx; font-weight: 600; }
.row-sub { font-size: 26rpx; color: var(--fg-2); margin-top: 10rpx; line-height: 1.6; }
.row .arrow { margin-left: auto; }
.row.danger .row-title { color: var(--danger); }
.row.danger .row-sub { color: var(--danger-soft); }
.row.danger .arrow .iconfont { color: var(--danger); }
.sheet-head { display: flex; flex-direction: column; gap: 8rpx; }
.grab { width: 80rpx; height: 8rpx; border-radius: 4rpx; background: var(--border); margin: 0 auto 20rpx; }
.sheet-title { font-size: 34rpx; font-weight: 600; }
.sheet-desc { font-size: 28rpx; color: var(--fg-2); line-height: 1.65; margin-top: 12rpx; }
.sheet-action { display: block; flex: 1; }
.edit-form { margin-top: 28rpx; }
.edit-field { margin-top: 24rpx; }
.edit-label { font-size: 28rpx; color: var(--fg-2); display: block; margin-bottom: 12rpx; }
.edit-input { border: 1rpx solid var(--border); background: var(--surface); border-radius: var(--radius-md); height: 84rpx; padding: 0 24rpx; font-size: 28rpx; color: var(--fg); }
.edit-textarea { border: 1rpx solid var(--border); background: var(--surface); border-radius: var(--radius-md); min-height: 180rpx; padding: 20rpx 24rpx; font-size: 28rpx; color: var(--fg); width: 100%; box-sizing: border-box; }
.gender-row { display: flex; gap: 20rpx; margin-top: 12rpx; }
.gender-btn { flex: 1; }
.gender-btn.disabled { opacity: 0.5; }
.ri-ic image{width:34rpx;height:34rpx;opacity:.72}.account-avatar{width:104rpx;height:104rpx;border-radius:22rpx;background:var(--accent-soft);color:var(--accent-text);display:flex;align-items:center;justify-content:center;font-size:38rpx;font-weight:700}.account-head{display:flex;align-items:center;gap:18rpx;padding:24rpx 0}.account-name{font-size:34rpx;font-weight:700}.account-id{font-size:23rpx;color:var(--muted);margin-top:6rpx}.logout-btn{margin-top:28rpx}
/* V22 */
.content{padding-top:8rpx}.row-list{margin-top:10rpx}.hint.mt-32{font-size:22rpx;line-height:1.55}

\\\\n\n### account/index.json\n`\{
  "usingComponents": {
    "nav-bar": "/components/nav-bar/index",
    "btn": "/components/btn/index",
    "tab-bar": "/components/tabbar/index"
  },
  "navigationBarTitleText": "个人资料"
}

\\\\n\n
---\n\n## 页面: privacy-manage\n\n### privacy-manage/index.js\n`\const { toast, reLaunch } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: { delVisible: false },
  onDataInfo() {
    toast("当前保存的数据包括人物照片、身体参数、衣物与试穿记录");
  },
  openDel() { this.setData({ delVisible: true }); },
  closeDel() { this.setData({ delVisible: false }); },
  confirmDel() {
    if (this._deleting) return;
    this._deleting = true;
    this.setData({ delVisible: false });
    api.deleteUserData().then((res) => {
      this._deleting = false;
      const app = getApp();
      if (app && app.globalData) app.globalData.loggedIn = false;
      toast(res && res.status === "completed" ? "数据已删除" : "删除任务已提交", 2000);
      setTimeout(() => reLaunch("/pages/login/index"), 800);
    }).catch(() => {
      this._deleting = false;
      toast("删除失败，请重试");
    });
  }
});

\\\\n\n### privacy-manage/index.wxml\n`\<view class="wx-page">
  <nav-bar title="隐私与数据管理" showBack="{{true}}"></nav-bar>

  <view class="content">
    <view class="subtitle">照片与身体数据仅用于人物基准、衣橱和试穿相关功能；删除后不可恢复。</view>

    <view class="row-list">
      <view class="row" hover-class="row-hover" bindtap="onDataInfo">
        <view class="ri-ic neu"><image class="ic-img" style="width:38rpx;height:38rpx" src="/assets/icons/png/icon-shield-check-gray.png" /></view>
        <view class="ri-main"><view class="ri-title">已授权数据</view><view class="ri-sub">人物照片、身体参数及试穿数据</view></view>
        <view class="ri-end"><image class="ic-img" style="width:28rpx;height:28rpx" src="/assets/icons/png/icon-chevron-right-gray.png" /></view>
      </view>
      <view class="row" hover-class="row-hover" bindtap="openDel">
        <view class="ri-ic"><image class="ic-img" style="width:38rpx;height:38rpx" src="/assets/icons/png/icon-camera-deep.png" /></view>
        <view class="ri-main"><view class="ri-title">删除我的全部数据</view><view class="ri-sub">人物、照片、衣物、试穿记录和相关云端文件</view></view>
        <view class="ri-end"><image class="ic-img" style="width:28rpx;height:28rpx" src="/assets/icons/png/icon-chevron-right-gray.png" /></view>
      </view>
    </view>

    <view class="danger-hint">当前版本删除操作会立即启动服务端清理；删除后不可恢复。</view>
  </view>

  <tab-bar selected="{{2}}" navMode="{{true}}" pill="{{true}}"></tab-bar>

  <sheet visible="{{delVisible}}" bind:cancel="closeDel">
    <view class="sheet-head">
      <view class="grab"></view>
      <text class="sheet-title">确认删除全部数据</text>
      <text class="sheet-desc">将删除人物档案、人物照片、衣物、试穿任务与结果、收藏、额度记录及关联云端文件。此操作不可恢复。</text>
    </view>
    <view slot="actions" class="sheet-actions">
      <btn class="sheet-action" type="danger" bindtap="confirmDel">确认删除</btn>
      <btn class="sheet-action" type="secondary" bindtap="closeDel">取消</btn>
    </view>
  </sheet>
</view>

\\\\n\n### privacy-manage/index.wxss\n`\.wx-page { height: 100vh; display: flex; flex-direction: column; background: var(--bg); overflow: hidden; }
.nav-btn { width: 80rpx; height: 80rpx; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); color: var(--fg); transition: background 0.15s ease; }
.nav-btn-hover { background: var(--surface-2); }
.nav-btn .iconfont { font-size: 42rpx; }
.content { flex: 1; overflow-y: auto; padding: 8rpx 24rpx 48rpx; }
.privacy-list { display: flex; flex-direction: column; gap: 16rpx; }
.privacy-row { display: flex; align-items: center; justify-content: space-between; padding: 28rpx 32rpx; border-radius: var(--radius-md); background: var(--surface); border: 1rpx solid var(--border-soft); box-shadow: var(--shadow-card); }
.privacy-row-copy { flex: 1; min-width: 0; }
.privacy-row-title { font-size: 30rpx; font-weight: 600; }
.privacy-row-sub { font-size: 26rpx; color: var(--fg-2); margin-top: 8rpx; line-height: 1.55; }
.privacy-row .switch { flex-shrink: 0; }
.privacy-note { margin-top: 32rpx; padding: 24rpx 28rpx; border-radius: var(--radius-md); background: var(--accent-soft); }
.privacy-note-text { font-size: 26rpx; color: var(--accent-deep); line-height: 1.6; }

\\\\n\n### privacy-manage/index.json\n`\{
  "usingComponents": {
    "nav-bar": "/components/nav-bar/index",
    "btn": "/components/btn/index",
    "sheet": "/components/sheet/index",
    "tab-bar": "/components/tabbar/index"
  },
  "navigationBarTitleText": "隐私与数据管理"
}

\\\\n\n
---\n\n## 页面: feedback-about\n\n### feedback-about/index.js\n`\const { toast, navigate } = require("../../utils/interaction");

Page({
  data: {
    fbText: "",
    formOk: false
  },
  onInput(e) { this.setData({ fbText: e.detail.value }); },
  onSubmit() {
    if (!this.data.fbText.trim()) {
      // 空反馈直接提交会污染反馈通道
      toast("请先填写反馈内容");
      return;
    }
    this.setData({ formOk: true });
    toast("感谢你的反馈");
  },
  goProfile() { navigate("/pages/profile/index"); }
});

\\\\n\n### feedback-about/index.wxml\n`\<view class="wx-page">
  <nav-bar title="关于我们" showBack="{{true}}"></nav-bar>

  <view class="content">
    <view class="feedback-label">遇到的问题或建议</view>
    <textarea class="feedback-input" placeholder="请输入你的意见或建议..." maxlength="200" value="{{fbText}}" bindinput="onInput" />

    <btn type="primary" block="{{true}}" class="feedback-submit" bindtap="onSubmit"><image class="btn-icon btn-icon-white" src="/assets/icons/png/icon-feedback-gray.png" />提交反馈</btn>
    <view wx:if="{{formOk}}" class="form-success">
      <image class="ic-img" style="width:28rpx;height:28rpx" src="/assets/icons/png/icon-check-green.png" />
      当前版本反馈会保留在本页；如需人工联系，请使用下方邮箱
    </view>

    <view class="sec-hd"><text class="sec-title">关于我形我衣</text></view>
    <view class="about-list">
      <view class="about-item"><text class="ab-title">AI 生成说明</text>试穿效果图由 AI 生成，仅供参考，可能与实物存在色差与形变。</view>
      <view class="about-item"><text class="ab-title">联系方式</text>support@myshape.app</view>
    </view>
  </view>

  

  <tab-bar selected="{{2}}" navMode="{{true}}" pill="{{true}}"></tab-bar>
</view>

\\\\n\n### feedback-about/index.wxss\n`\.wx-page { height: 100vh; display: flex; flex-direction: column; background: var(--bg); overflow: hidden; }
.nav-btn { width: 80rpx; height: 80rpx; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); color: var(--fg); transition: background 0.15s ease; }
.nav-btn-hover { background: var(--surface-2); }
.nav-btn .iconfont { font-size: 42rpx; }
.content { flex: 1; overflow-y: auto; padding: 8rpx 24rpx 48rpx; }
.feedback-form { display: flex; flex-direction: column; gap: 28rpx; }
.feedback-field { display: flex; flex-direction: column; gap: 12rpx; }
.feedback-label { font-size: 28rpx; color: var(--fg-2); }
.feedback-input { border: 1rpx solid var(--border); background: var(--surface); border-radius: var(--radius-md); min-height: 240rpx; padding: 24rpx; font-size: 28rpx; color: var(--fg); width: 100%; box-sizing: border-box; transition: border-color 0.2s ease; }
.feedback-input:focus { border-color: var(--accent); }
.feedback-submit { margin-top: 12rpx; }
.feedback-submit .btn { width: 100%; }
.about-list { margin-top: 48rpx; display: flex; flex-direction: column; gap: 16rpx; }
.about-item { display: flex; align-items: center; justify-content: space-between; padding: 28rpx 32rpx; border-radius: var(--radius-md); background: var(--surface); border: 1rpx solid var(--border-soft); box-shadow: var(--shadow-card); transition: all 0.2s var(--ease); }
.about-item-hover { box-shadow: var(--shadow-card-hover); }
.about-item-label { font-size: 28rpx; font-weight: 600; }
.about-item-value { font-size: 26rpx; color: var(--fg-2); }
/* V22 */
.content{padding-top:20rpx}.feedback-label{font-size:27rpx;font-weight:600;color:var(--fg);margin-bottom:12rpx;display:block}.feedback-input{min-height:260rpx;border-radius:20rpx;box-shadow:none;background:var(--surface);font-size:27rpx}.feedback-submit{margin-top:16rpx}.form-success{display:flex;align-items:flex-start;gap:8rpx;padding:16rpx 18rpx;border-radius:16rpx;background:#F0F6EF;color:#557052;font-size:23rpx;line-height:1.5;margin-top:12rpx}.about-list{margin-top:28rpx;gap:10rpx}.about-item{display:block;padding:20rpx 22rpx;border-radius:18rpx;box-shadow:none;font-size:24rpx;line-height:1.55}.ab-title{display:block;font-size:26rpx;font-weight:650;margin-bottom:5rpx}

\\\\n\n### feedback-about/index.json\n`\{
  "usingComponents": {
    "nav-bar": "/components/nav-bar/index",
    "btn": "/components/btn/index",
    "tab-bar": "/components/tabbar/index"
  },
  "navigationBarTitleText": "关于我们"
}

\\\\n\n
