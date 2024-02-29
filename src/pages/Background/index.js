// 当前标签页 url
const apzProxyExtensionElementId = 'apz_proxy_template_config_extension';
const currentTab = {
  development: {},
  testing: {},
  production: {},
};
const apzAdminPortalAuthToken = {
  development: {},
  testing: {},
  production: {},
}
const JUMP_STATUS = {
  development: true,
  testing: true,
  production: true,
}
const ADMIN_PORTAL_URL_ORIGINS = {
  development: 'http://localhost:8000',
  testing: 'https://admin.automizely.me',
  production: 'https://admin.automizely.org',
}
const INITIATORS = {
  development: 'http://localhost:3343',
  testing: 'https://personalization.automizely.io',
  production: 'https://personalization.automizely.com',
};
const INITIATOR_REQUEST_URL_ORIGINS = {
  development: 'http://localhost:9007',
  testing: 'https://bff-api.automizely.io',
  production: 'https://bff-api.automizely.com',
};
const INITIATORS_ORIGIN_MAP_ENV = new Map([
  [INITIATORS.development, 'development'],
  [INITIATORS.testing, 'testing'],
  [INITIATORS.production, 'production'],
]);
const REDIRECT_URL_ORIGINS = {
  development: 'http://localhost:9006',
  testing: 'https://bff-api.automizely.me',
  production: 'https://bff-api.automizely.org',
}
const AUTH_SENDER_ORIGIN_MAP_ENV = new Map([
  [ADMIN_PORTAL_URL_ORIGINS.development, 'development'],
  [ADMIN_PORTAL_URL_ORIGINS.testing, 'testing'],
  [ADMIN_PORTAL_URL_ORIGINS.production, 'production'],
]);
const BLOCKING_URLS = [
  `${REDIRECT_URL_ORIGINS.development}/personalization/portal/graphql`,
  `${REDIRECT_URL_ORIGINS.testing}/personalization/portal/graphql`,
  `${REDIRECT_URL_ORIGINS.production}/personalization/portal/graphql`,
  `${INITIATOR_REQUEST_URL_ORIGINS.development}/personalization/admin/graphql`,
  `${INITIATOR_REQUEST_URL_ORIGINS.testing}/personalization/admin/graphql`,
  `${INITIATOR_REQUEST_URL_ORIGINS.production}/personalization/admin/graphql`,
];

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  const url = new URL(tab?.url);
  const env = INITIATORS_ORIGIN_MAP_ENV.get(url.origin);
  if (env) {
    currentTab[env] = tab;
  }
});

chrome.tabs.onActivated.addListener(function (activeInfo) {
  chrome.tabs.get(activeInfo.tabId, function (tab) {
    if (tab?.url) {
      const url = new URL(tab.url);
      const env = INITIATORS_ORIGIN_MAP_ENV.get(url.origin);
      if (env) {
        currentTab[env] = tab;
      }
    }
  })
})
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  const env = AUTH_SENDER_ORIGIN_MAP_ENV.get(sender.origin);
  apzAdminPortalAuthToken[env] = { ...request.authToken, tabUrl: sender.tab.url};
})
// 拦截请求体或请求地址，请求体和请求地址不可同时更改，只可改其中之一
chrome.webRequest.onBeforeRequest.addListener(
  function (details) {
    const isProxy = getIsProxy(details);
    if (isProxy) {
      const redirectUrl = getRequestRedirectUrl(details.url);
      if (redirectUrl) {
        return { redirectUrl: redirectUrl };
      }
    }
    return { cancel: false };
  },
  { urls: BLOCKING_URLS },
  ['blocking', 'requestBody']
);
/**
 * 拦截请求头
*/
chrome.webRequest.onBeforeSendHeaders.addListener(
  function (details) {
    const changed = haveBeenRequestedModified(details.initiator, details.url);
    if (changed) {
      const authToken = apzAdminPortalAuthToken[getEnv(details.url)];
      let headers = details.requestHeaders;
      headers = headers.filter((item) => {
        return item.name !== 'authorization';
      });
      headers.push({
        name: 'authorization',
        value: `${authToken.type} ${authToken.token}`,
      });
      return { requestHeaders: headers };
    }
  },
  { urls: BLOCKING_URLS },
  ['blocking', 'requestHeaders']
);
chrome.webRequest.onCompleted.addListener(function(details) {
  if (details.statusCode === 200) {
    const env = getEnv(details.url);
    if (env !== undefined && !JUMP_STATUS[env]) {
      JUMP_STATUS[env] = true
      const url = apzAdminPortalAuthToken[env].tabUrl;
      if (url) {
        chrome.tabs.query({ url }, function (tabs) {
          if (tabs.length) {
            chrome.tabs.update(tabs[0].id, { active: true,url: tabs[0].url });
          } else {
            chrome.tabs.create({ url }, function (newTab) {
              chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                if (info.status === 'complete' && tabId === newTab.id) {
                  chrome.tabs.onUpdated.removeListener(listener);
                  chrome.tabs.update(newTab.id, { active: true });
                }
              });
            });
          }
        });
      }
    }
  }
}, { urls: BLOCKING_URLS });

// 监听扩展被禁用或卸载的事件
chrome.runtime.onSuspend.addListener(function () {
  // 删除元素
  const element = document.getElementById(apzProxyExtensionElementId);
  if (element) {
    element.parentNode.removeChild(element);
  }
});

/**
 * 拦截条件
 * 1. 从 APZ Admin Portal 来的
 * 2. 发起请求的接口时的 GetWidgetById / UpdateWidgetSetting
*/
function getIsProxy(details) {
  const env = getEnv(details.url);
  if(!env) return false
  const isAPZAdminPortal = getUrlSource(env);
  const isIntercepted = getInterceptedGraphql(
    details.url,
    details.method,
    details.requestBody
  );
  return isAPZAdminPortal && isIntercepted
}

function getUrlSource(env) {
  const currentUrl = currentTab[env]?.url;
  if (!currentUrl) {
    return false;
  }
  const url = new URL(currentUrl);
  const searchParams = new URLSearchParams(url.search);
  const source = searchParams.get('source');
  return source === 'apz_admin_portal';
}

function getInterceptedGraphql(requestUrl, requestMethod, requestBodies) {
  if (requestMethod === 'POST' && requestBodies) {
    const decoder = new TextDecoder('utf-8');
    const requestBody = JSON.parse(decoder.decode(requestBodies.raw[0].bytes));
    const isArray = Array.isArray(requestBody);
    if (isArray) {
      const env = getEnv(requestUrl);
      const operationName = requestBody[0].operationName.toLowerCase();
      if (operationName === 'updatewidgetsetting') {
        JUMP_STATUS[env] = false;
      }
      const INTERCEPTED_GRAPHQL_OPERATIONS = ['getwidgetbyid', 'updatewidgetsetting'];
      const isIntercepted =
        INTERCEPTED_GRAPHQL_OPERATIONS.includes(operationName);
      return isIntercepted;
    }
    return false;
  }
  return false
}

function getRequestRedirectUrl(requestUrl) {
  const REDIRECT_URL_MAP = new Map([
    [
      INITIATOR_REQUEST_URL_ORIGINS.development,
      REDIRECT_URL_ORIGINS.development,
    ],
    [INITIATOR_REQUEST_URL_ORIGINS.testing, REDIRECT_URL_ORIGINS.testing],
    [INITIATOR_REQUEST_URL_ORIGINS.production, REDIRECT_URL_ORIGINS.production],
  ]);
  const url = new URL(requestUrl);
  const redirectDomain = REDIRECT_URL_MAP.get(url.origin);
  if (!redirectDomain) return
  return redirectDomain + '/personalization/portal/graphql';
}

function haveBeenRequestedModified(initiatorUrl, requestUrl) {
  const INITIATOR = [
    INITIATORS.development,
    INITIATORS.testing,
    INITIATORS.production,
  ];
  const REDIRECT_ORIGINS = [
    REDIRECT_URL_ORIGINS.development,
    REDIRECT_URL_ORIGINS.testing,
    REDIRECT_URL_ORIGINS.production,
  ];
  const isInitiator = INITIATOR.includes(initiatorUrl);
  const url = new URL(requestUrl);
  return isInitiator && REDIRECT_ORIGINS.includes(url.origin);
}

function getEnv (requestUrl) {
  const PROXY_ENV_MAPS = new Map([
    [REDIRECT_URL_ORIGINS.development, 'development'],
    [REDIRECT_URL_ORIGINS.testing, 'testing'],
    [REDIRECT_URL_ORIGINS.production, 'production'],
  ])
  const INITIATOR_ENV_MAPS = new Map([
    [INITIATOR_REQUEST_URL_ORIGINS.development, 'development'],
    [INITIATOR_REQUEST_URL_ORIGINS.testing, 'testing'],
    [INITIATOR_REQUEST_URL_ORIGINS.production, 'production'],
  ]);
  const url = new URL(requestUrl);
  return PROXY_ENV_MAPS.get(url.origin) || INITIATOR_ENV_MAPS.get(url.origin);
}