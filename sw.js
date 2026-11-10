/* LevelUp court bar: offline copy of the page.
   - This site's own files: try the network first (so edits still arrive),
     fall back to the saved copy if the network fails or takes over 4 seconds.
   - Fonts / fixed-version libraries: saved copy first.
   - Everything else (schedule API, birthdays, Eagle Eye, Firebase data): untouched. */
var CACHE = "levelup-court-v1";
var PRECACHE = ["display.html", "levelup-logo.png"];
var TIMEOUT_MS = 4000;

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return Promise.all(PRECACHE.map(function(u){
        var abs = new URL(u, self.location.href);
        return fetch(abs.href).then(function(r){
          if(r && r.ok) return c.put(abs.origin + abs.pathname, r);
        })["catch"](function(){});
      }));
    }).then(function(){ if(self.skipWaiting) return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if(k.indexOf("levelup-court-") === 0 && k !== CACHE) return caches["delete"](k);
      }));
    }).then(function(){ if(self.clients && self.clients.claim) return self.clients.claim(); })
  );
});

function networkFirst(req, key){
  return caches.open(CACHE).then(function(c){
    return new Promise(function(resolve){
      var done = false;
      var timer = setTimeout(function(){
        c.match(key).then(function(hit){ if(hit && !done){ done = true; resolve(hit); } });
      }, TIMEOUT_MS);
      fetch(req).then(function(res){
        clearTimeout(timer);
        if(res && res.ok){ try{ c.put(key, res.clone()); }catch(e){} }
        if(!done){ done = true; resolve(res); }
      })["catch"](function(){
        clearTimeout(timer);
        c.match(key).then(function(hit){
          if(!done){ done = true; resolve(hit || Response.error()); }
        });
      });
    });
  });
}

function cacheFirst(req, key){
  return caches.open(CACHE).then(function(c){
    return c.match(key).then(function(hit){
      if(hit) return hit;
      return fetch(req).then(function(res){
        if(res && (res.ok || res.type === "opaque")){ try{ c.put(key, res.clone()); }catch(e){} }
        return res;
      });
    });
  });
}

self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method !== "GET") return;
  var url;
  try{ url = new URL(req.url); }catch(err){ return; }
  if(url.origin === self.location.origin){
    e.respondWith(networkFirst(req, url.origin + url.pathname));
    return;
  }
  if(url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com" ||
     (url.hostname === "www.gstatic.com" && url.pathname.indexOf("/firebasejs/") === 0)){
    e.respondWith(cacheFirst(req, url.href));
    return;
  }
});
