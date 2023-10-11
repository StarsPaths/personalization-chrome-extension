chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
       chrome.storage.sync.get(['environments'], (result) => {

              const proxy={
                incy:{
                  source:'sdks.automizely.io',
                  target:'release-incy-sdks.automizely.io'
                },
                kiwi:{
                  source:'sdks.automizely.io',
                  target:'release-kiwi-sdks.automizely.io'
                },
                staging:{
                  source:'sdks.automizely.com',
                  target:'staging-sdks.automizely.com'
                }
              };
              const initialRules = [
                {
                  id: 2,
                  priority: 2,
                  action: {
                    type:"redirect", 
                    redirect: {
                        transform: { scheme: "https", host:proxy[result?.environments]?.target }
                    }
                  },
                  condition: {
                  urlFilter:  proxy[result?.environments]?.source ,
                },
                },
              ];

                 chrome.declarativeNetRequest.getDynamicRules(function (res) {
                  console.log('remove');
                   let rules = res.map((e) => e.id);
                   chrome.declarativeNetRequest.updateDynamicRules(
                     {
                       addRules: result?.environments!=='none'? initialRules:[], //Rule[] optional
                       removeRuleIds: rules, //number[] optional
                     },
                     function (callback) {}
                   );
                 });
                 });
       
      // 发送响应消息
       sendResponse({ response: "Message received successfully!" });
     });