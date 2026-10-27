/* Worker do conversor de vídeo (ffmpeg.wasm 0.12, núcleo de thread única) */
let core=null;
self.onmessage=async({data:m})=>{
  try{
    if(m.type==='load'){
      importScripts('ffmpeg-core.js');
      const url=new URL('ffmpeg-core.js',self.location.href).href;
      core=await self.createFFmpegCore({wasmBinary:m.wasm,mainScriptUrlOrBlob:url+'#'+btoa(JSON.stringify({wasmURL:url.replace(/\.js$/,'.wasm'),workerURL:''}))});
      core.setProgress(({progress})=>self.postMessage({type:'progress',p:progress}));
      core.setLogger(()=>{});
      self.postMessage({id:m.id,ok:true});
    }else if(m.type==='exec'){
      core.FS.writeFile(m.inName,m.input);
      if(core.setTimeout)core.setTimeout(-1);
      core.exec(...m.args);const ret=core.ret;core.reset();
      let out=null;try{out=core.FS.readFile(m.out)}catch(e){}
      try{core.FS.unlink(m.inName)}catch(e){}try{core.FS.unlink(m.out)}catch(e){}
      if(!out||!out.byteLength)throw new Error('ffmpeg terminou com código '+ret);
      self.postMessage({id:m.id,output:out},[out.buffer]);
    }
  }catch(e){self.postMessage({id:m.id,error:String(e&&e.message||e)})}
};
