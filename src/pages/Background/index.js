// 当前标签页 url
let currentTab = {};
let requestBodies = {};
let requestHeaders = {};
let apzAdminPortalAuthToken = ''
const BLOCKING_URLS = [
  'http://localhost:9007/personalization/admin/graphql',
  'https://bff-api.automizely.io/personalization/admin/graphql',
  'https://bff-api.automizely.com/personalization/admin/graphql',
];
const APP_KEYS = []
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  currentTab = tab;
});
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  apzAdminPortalAuthToken = request.authToken;
})
// 拦截请求体或请求地址，请求体和请求地址不可同时更改，只可改其中之一
chrome.webRequest.onBeforeRequest.addListener(
  function (details) {
    requestBodies = details.requestBody;
    const isProxy = getIsProxy(details.method, details.requestBody);
    console.log('onBeforeRequest isProxy: ', isProxy);
    if (isProxy) {
      const redirectUrl = getRequestRedirectUrl(details.url);
      return { redirectUrl: redirectUrl };
    }
    return { cancel: false };
  },
  { urls: BLOCKING_URLS },
  ['blocking', 'requestBody']
);
/**
 * 拦截请求头
 * onBeforeSendHeaders 无法执行异步的操作，若是要添加异步的 token 则可能需要在业务测添加
*/
chrome.webRequest.onBeforeSendHeaders.addListener(
  function (details) {
    requestHeaders = details.requestHeaders;
    const isProxy = getIsProxy(details.method, requestBodies);
    let headers = details.requestHeaders;
    if (isProxy) {
      headers = headers.filter((item) => {
        return item.name !== 'authorization';
      });
      headers.push({
        name: 'authorization',
        value: `${apzAdminPortalAuthToken?.type} ${apzAdminPortalAuthToken?.token}`,
      });
    }
    return { requestHeaders: headers };
  },
  { urls: BLOCKING_URLS },
  ['blocking', 'requestHeaders']
);

/**
 * 拦截条件
 * 1. 从 APZ Admin Portal 来的
 * 2. 发起请求的接口时的 GetWidgetById / UpdateWidgetSetting
 * 3. 有权限的 app key
*/
function getIsProxy(requestMethod, requestBodies) {
  const appkey = requestHeaders?.find(
    (item) => item.name === 'am-app-key'
  )?.value;
  const hasPermissionAppKey = APP_KEYS.includes(appkey);
  const isAPZAdminPortal = getUrlSource();
  const isIntercepted = getInterceptedGraphql(requestMethod, requestBodies);
  return isAPZAdminPortal && isIntercepted && !hasPermissionAppKey;
}

function getUrlSource() {
  const url = new URL(currentTab.url);
  const searchParams = new URLSearchParams(url.search);
  const source = searchParams.get('source');
  return source === 'apz_admin_portal';
}

function getInterceptedGraphql(requestMethod, requestBodies) {
  if (requestMethod === 'POST' && requestBodies) {
    const decoder = new TextDecoder('utf-8');
    const requestBody = JSON.parse(decoder.decode(requestBodies.raw[0].bytes));
    const isArray = Array.isArray(requestBody);
    if (isArray) {
      const INTERCEPTED_GRAPHQL_OPERATIONS = ['GetWidgetById', 'UpdateWidgetSetting'];
      const isIntercepted = INTERCEPTED_GRAPHQL_OPERATIONS.includes(
        requestBody[0].operationName
      );
      return isIntercepted;
    }
    return false;
  }
  return false
}

function getRequestRedirectUrl(requestUrl) {
  const REDIRECT_URL = new Map([
    ['http://localhost:9007', 'http://localhost:9006'],
    ['http://127.0.0.1:9007', 'http://localhost:9006'],
    ['https://bff-api.automizely.io', 'https://bff-api.automizely.me'],
    ['https://bff-api.automizely.com', 'https://bff-api.automizely.org'],
  ]);
  const url = new URL(requestUrl);
  const redirectDomain = REDIRECT_URL.get(url.origin);
  return redirectDomain + '/personalization/portal/graphql';
}