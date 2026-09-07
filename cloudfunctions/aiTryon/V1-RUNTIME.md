# V1 Try-On Runtime

唯一生产 Provider：DashScope `aitryon`。

主链：Person Asset + 1 garment -> reference preflight -> quota -> async submit -> task polling -> result.

V1 不启用 Agnes、Mock、aitryon-plus、Video、legacy fallback。
历史兼容文件可以保留，但不属于运行时路径。


## 2026-09-04 storage fix

修复公网参考图安全下载：TCP 连接仍固定到 DNS 校验后的公网 IP，同时恢复原始域名的 HTTP Host 与 HTTPS SNI，避免 CloudBase 临时 URL 因虚拟主机/证书错位出现“下载失败”。
