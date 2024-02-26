import { printLine } from './modules/print';

console.log('Content script works!');
console.log('Must reload extension for modifications to take effect.');

printLine("Using the 'printLine' function from the Print Module");
const apzProxyExtensionElementId = 'apz_proxy_template_config_extension';

/**
 * 用来监听 admin portal 页面发送过来的 token，此 token 用于接口代理时使用
*/
window.addEventListener(
  'message',
  function (event) {
    // 我们只接受来自我们自己的消息
    if (event.source != window) return;
    if (event.data?.source === 'apz_admin_portal') {
      chrome.runtime.sendMessage({ authToken: event.data });
    }
  },
  false
);

/**
 * 此方法是在 admin portal 页面中注入一个隐藏的 div 元素，用来校验是否有安装或开启该 extension。
 * 在 Background/index.js 中，chrome.runtime.onSuspend.addListener 用来监听该 extenison 是否被卸载货关闭，是，则清除该 div 元素。但需要每次刷新页面才可生效
*/
function executeScript() {
  const origins = ['http://localhost:8000', 'https://admin.automizely.me', 'https://admin.automizely.org'];
  const currentOrigin = window.location.origin;
  const isExecute = origins.includes(currentOrigin);
  const isExistedElement = document.getElementById(apzProxyExtensionElementId);
  if (isExecute && !isExistedElement) {
    const element = document.createElement('div');
    element.id = apzProxyExtensionElementId;
    element.style.display = 'none';
    document.body.appendChild(element);
  }
}
executeScript()