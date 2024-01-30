import { printLine } from './modules/print';

console.log('Content script works!');
console.log('Must reload extension for modifications to take effect.');

printLine("Using the 'printLine' function from the Print Module");

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