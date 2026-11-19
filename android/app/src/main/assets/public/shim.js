/* Pengganti runtime claude.ai: semua data disimpan OFFLINE di penyimpanan perangkat (localStorage WebView). */
(function(){
  "use strict";
  var PFX="iuranpb:";
  var subs={}; // path koleksi -> Set<fn>

  function read(col){
    var out=[];
    try{
      for(var i=0;i<localStorage.length;i++){
        var k=localStorage.key(i);
        if(k.indexOf(PFX+col+"/")===0){
          try{out.push({id:k.slice((PFX+col+"/").length),v:JSON.parse(localStorage.getItem(k))})}catch(e){}
        }
      }
    }catch(e){}
    return out;
  }
  function snapOf(col){
    var docs=read(col).map(function(r){return {id:r.id,exists:true,data:function(){return r.v}}});
    return {docs:docs,size:docs.length,empty:!docs.length,forEach:function(f){docs.forEach(f)}};
  }
  function notify(col){
    (subs[col]||[]).forEach(function(fn){try{fn.ok(snapOf(col))}catch(e){}});
  }
  function onCol(col,ok,err){
    var rec={ok:ok,err:err};
    (subs[col]=subs[col]||[]).push(rec);
    setTimeout(function(){try{ok(snapOf(col))}catch(e){}},0);
    return function(){subs[col]=(subs[col]||[]).filter(function(x){return x!==rec})};
  }

  var db={
    collection:function(col){return {onSnapshot:function(ok,err){return onCol(col,ok,err)}}},
    doc:function(path){
      var i=path.lastIndexOf("/"),col=path.slice(0,i),id=path.slice(i+1),key=PFX+path;
      return {
        set:function(data){
          return new Promise(function(res,rej){
            try{localStorage.setItem(key,JSON.stringify(data));notify(col);res()}
            catch(e){rej({code:"storage_error",message:"Penyimpanan penuh atau tidak tersedia"})}
          });
        },
        delete:function(){
          return new Promise(function(res){try{localStorage.removeItem(key)}catch(e){}notify(col);res()});
        },
        onSnapshot:function(ok,err){
          var f=function(){
            var v=null;try{v=JSON.parse(localStorage.getItem(key))}catch(e){}
            ok({id:id,exists:v!=null,data:function(){return v}});
          };
          var rec={ok:f,err:err};
          (subs[col]=subs[col]||[]).push(rec);
          setTimeout(f,0);
          return function(){subs[col]=(subs[col]||[]).filter(function(x){return x!==rec})};
        }
      };
    }
  };

  var user={
    canEdit:function(){return Promise.resolve(true)},
    isOwner:function(){return true},
    id:function(){return Promise.resolve("local")},
    me:function(){return Promise.resolve({name:"Perangkat ini"})},
    profiles:function(){return Promise.resolve({})},
    search:function(){return Promise.resolve([])}
  };

  function blobToBase64(blob){
    return new Promise(function(res,rej){
      var r=new FileReader();
      r.onload=function(){res(String(r.result).split(",")[1])};
      r.onerror=function(){rej(r.error)};
      r.readAsDataURL(blob);
    });
  }
  var downloads={
    save:async function(o){
      var P=window.Capacitor&&window.Capacitor.Plugins;
      var native=window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform();
      if(native&&P&&P.Filesystem){
        var b64=await blobToBase64(o.data);
        var w=await P.Filesystem.writeFile({path:o.filename,data:b64,directory:"CACHE"});
        if(P.Share){await P.Share.share({title:o.filename,url:w.uri,dialogTitle:"Simpan / bagikan PDF"})}
        return;
      }
      var a=document.createElement("a");
      a.href=URL.createObjectURL(o.data);a.download=o.filename;
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(function(){URL.revokeObjectURL(a.href)},4000);
    }
  };

  var caps={db:db,user:user,downloads:downloads};
  window.claude={use:function(n){return Promise.resolve(caps[n]||null)}};
})();
