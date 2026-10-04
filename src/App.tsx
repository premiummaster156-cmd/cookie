    if(rank<required){onToolNotice(tool.name+" requires a "+(tool.plan==="max"?"MAX":"PRO")+" plan.");setToolsOpen(false);return}
    setToolMode(tool.id);setToolsOpen(false);
    if(tool.id==="file-analysis"&&!attachments.length)onToolNotice("Attach a file or image, then send your request.");
    
  };
  return <div className="composer-wrap">
    {!!toolMode&&<div className="tool-chip"><span><Wrench size={13}/>{tools.find(x=>x.id===toolMode)?.name||"Tool"}</span><button onClick={()=>setToolMode(null)} aria-label="Remove tool"><X size={13}/></button></div>}
    {webSearch&&<div className="search-chip"><Globe2 size={13}/><span>Web research enabled</span><button onClick={()=>setWebSearch(false)} aria-label="Turn off web research"><X size={13}/></button></div>}
    {!!attachments.length&&<div className="attachment-strip">{attachments.map(a=><div className="attachment-card" key={a.id}>{a.kind==="image"?<img src={a.data} alt=""/>:<div className="file-icon"><FileIcon size={18}/></div>}<div><b>{a.name}</b><span>{Math.max(1,Math.round(a.size/1024))} KB</span></div><button onClick={()=>setAttachments(p=>p.filter(x=>x.id!==a.id))}><X size={14}/></button></div>)}</div>}
    <div className="composer" data-liquid-glass="composer"><LiquidGlassBackdrop className="composer-glass-layer" options={{profile:"bar",variant:"regular",preset:"balanced",scheme:"adaptive",radius:22,backdropSource:".cookie-ambient-scene"}}/>
      <div className="composer-left">
      <div className="attach-wrap"><button className="composer-icon" aria-label="Add" onClick={()=>{setOpen(v=>!v);setToolsOpen(false)}}><Plus size={21}/></button>{open&&<div className="attach-menu popover-pop">
        <LiquidGlassBackdrop className="menu-glass-layer" options={{profile:"panel",variant:"regular",preset:"balanced",scheme:"adaptive",radius:12,backdropSource:".cookie-ambient-scene"}}/>
        <button onClick={()=>{imageRef.current?.click();setOpen(false)}}><ImageIcon size={18}/><span>Photos & images</span></button>
        <button onClick={()=>{cameraRef.current?.click();setOpen(false)}}><ImageIcon size={18}/><span>Camera</span></button>
        <button onClick={()=>{fileRef.current?.click();setOpen(false)}}><FilePlus2 size={18}/><span>Upload files</span></button>
        <button onClick={()=>{setOpen(false);setValue("Create an image of ");requestAnimationFrame(()=>textRef.current?.focus())}}><ImagePlus size={18}/><span>Create image</span></button>
        {!hideWebSearch&&<button className={webSearch?"active":""} onClick={()=>{setWebSearch(!webSearch);setOpen(false);textRef.current?.focus()}}><Globe2 size={18}/><span>{webSearch?"Web research on":"Search the web"}</span></button>}
       </div>}</div>
      {!hideTools&&<div className="tools-wrap attach-wrap">
        <button className={"composer-icon tool-button "+(toolsOpen?"active":"")} aria-label="Tools" onClick={()=>{setToolsOpen(v=>!v);setOpen(false)}}><Wrench size={18}/></button>
        {toolsOpen&&<div className="attach-menu tools-menu popover-pop">
          <LiquidGlassBackdrop className="menu-glass-layer" options={{profile:"panel",variant:"regular",preset:"balanced",scheme:"adaptive",radius:14,backdropSource:".cookie-ambient-scene"}}/>
          <div className="tools-menu-head"><span>Tools</span><small>Choose an action</small></div>
          {tools.map(tool=><button key={tool.id} className={toolMode===tool.id?"active":""} onClick={()=>chooseTool(tool)}><span className="tool-icon">{tool.icon}</span><span className="tool-copy"><b>{tool.name}</b><small>{tool.detail}</small></span>{(tool.plan!=="free"&&rank<(tool.plan==="max"?2:1))?<><LockKeyhole size={14}/><em>{tool.plan.toUpperCase()}</em></>:toolMode===tool.id?<Check size={14}/>:null}</button>)}
          <div className="tools-divider"/>
          <button className={memoryEnabled?"active":""} onClick={()=>{setMemoryEnabled(!memoryEnabled);setToolsOpen(false)}}><span className="tool-icon"><Brain size={18}/></span><span className="tool-copy"><b>Memory</b><small>{memoryEnabled?"Use saved preferences":"Memory is off"}</small></span></button>
          <div className="tools-menu-note"><FileSearch size={13}/><span>File analysis works with the files you attach.</span></div>
        </div>}
      </div>}
      <textarea ref={textRef} value={value} onChange={e=>{setValue(e.target.value);requestAnimationFrame(resizeInput)}} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&sendOnEnter){e.preventDefault();submit()}}} onBlur={()=>requestAnimationFrame(resizeInput)} placeholder="Message Cookie" rows={1}/>
      <div className="composer-right">{loading?<button className="composer-icon stop" onClick={onStop}><Square size={14} fill="currentColor"/></button>:<button className="composer-icon" onClick={onVoice}><Volume2 size={19}/></button>}{loading?<span className="generating-pill">Generating…</span>:<button className={"send-button "+(!(value.trim()||attachments.length)?"disabled":"")} disabled={!value.trim()&&!attachments.length} onClick={submit}><ArrowUp size={19}/></button>}</div>
    </div>
     </div>
    <div className="composer-note">Cookie can make mistakes. Check important info.</div>
    <input hidden ref={imageRef} type="file" accept="image/*" multiple onChange={e=>{add(e.target.files);e.currentTarget.value=""}}/>
    <input hidden ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={e=>{add(e.target.files);e.currentTarget.value=""}}/>
    <input hidden ref={fileRef} type="file" multiple onChange={e=>{add(e.target.files);e.currentTarget.value=""}}/>
  </div>;
}
function ChatView({chat,onSend,loading,onStop,onVoice,onCopy,onRetry,onDelete,onShare,onDownload,streamText="",streamStatus=""}:{chat:Chat|null;onSend:(text:string)=>void;loading:boolean;onStop:()=>void;onVoice:()=>void;onCopy:(m:Message)=>void;onRetry:(m:Message)=>void;onDelete:(m:Message)=>void;onShare:()=>void;onDownload:(f:GeneratedFile)=>void;streamText?:string;streamStatus?:string}){