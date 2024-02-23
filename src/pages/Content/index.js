import { printLine } from './modules/print';

console.log('Content script works!');
console.log('Must reload extension for modifications to take effect.');

printLine("Using the 'printLine' function from the Print Module");
const apzProxyExtensionElementId = 'apz_proxy_tempplate_config_extension';

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