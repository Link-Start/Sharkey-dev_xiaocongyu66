# 重要说明

> English: [IMPORTANT_NOTES.md](./IMPORTANT_NOTES.md)

运行与修改本项目前请阅读以下要点。

## 许可

本项目基于 **AGPL-3.0**。分发修改后的网络服务时，请遵守 AGPL 对源码提供的要求。详见 [LICENSE](./LICENSE)、[COPYING](./COPYING)。

## 联邦与安全

- 联邦会与不可信远程服务器通信，请正确配置防火墙、对象存储与限流。  
- 不要在前端或仓库中提交 API 密钥、PAT、数据库密码。  
- 生产环境请使用 HTTPS，并限制管理端口暴露。  

## 部署

推荐使用 Docker / Compose 或官方文档中的安装方式：  
https://docs.joinsharkey.org/

## 原文

完整英文说明见 [IMPORTANT_NOTES.md](./IMPORTANT_NOTES.md)。

<details>
<summary>原文摘录</summary>

```
# Basic Precautions

When using a service with Sharkey, there are several important points to keep in mind.

1. Because it is decentralized, there is no guarantee that data you upload will be deleted from all other servers even if you delete it once. (However, this applies to the internet in general.)

2. Even for posts made in private, there is no guarantee that the recipient's server will treat them as private in the same way. Please exercise caution when posting personal or confidential information. (Again, this applies to the internet in general.)

3. The "Drive" feature is NOT secure cloud storage. This feature exists for easier managing of your uploaded files.
Any data uploaded, whether shared via post or not, will be publicly accessible. Please use 3rd party cloud storage providers if you need to upload data with sensitive information of any kind. 

4. Account deletion can be a resource-intensive process and may take a long time. In cases with a lot of uploaded data, it may even be impossible to delete an account.

5. Please disable ad blockers. Some servers may rely on advertising revenue to cover operating costs. Additionally, ad blockers can mistakenly block content and features unrelated to ads, potentially causing issues with the client's functionality and preventing normal use of Sharkey. Therefore, we recommend turning off ad blockers and similar features when using Sharkey.

Please understand these points and enjoy using the service.

```

</details>
