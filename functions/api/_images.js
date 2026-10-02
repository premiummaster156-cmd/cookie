const DEFAULT_MODEL = "gpt-image-2.5-flare";

function envKey(env){
  const key=String(env?.OPENAI_API_KEY||"").trim();
  if(!key) throw new Error("OPENAI_API_KEY is not configured.");
  return key;
}

function cleanSize(value){
  return ["1024x1024","1536x1024","1024x1536","auto"].includes(String(value||""))
    ? String(value)
    : "1024x1024";
}

function dataUrlToBlob(dataUrl){
  const match=String(dataUrl||"").match(/^data:([^;]+);base64,(.+)$/);
  if(!match) return null;
  const binary=atob(match[2]);
  const bytes=Uint8Array.from(binary,ch=>ch.charCodeAt(0));
  return new Blob([bytes],{type:match[1]});
}

export async function generateImage(env,{prompt,size="1024x1024",quality="auto",imageData=""}={}){
  const key=envKey(env);
  const text=String(prompt||"").trim().slice(0,4000);
  if(!text) throw new Error("An image prompt is required.");
  const model=String(env?.OPENAI_IMAGE_MODEL||DEFAULT_MODEL).trim();
  const outputSize=cleanSize(size);

  let response;
  if(imageData){
    const image=dataUrlToBlob(imageData);
    if(!image) throw new Error("The source image could not be read.");
    const form=new FormData();
    form.append("model",model);
    form.append("prompt",text);
    form.append("size",outputSize);
    form.append("quality",String(quality||"auto"));
    form.append("output_format","png");
    form.append("image",image,"source.png");
    response=await fetch("https://api.openai.com/v1/images/edits",{
      method:"POST",
      headers:{Authorization:"Bearer "+key},
      body:form
    });
  }else{
    response=await fetch("https://api.openai.com/v1/images/generations",{
      method:"POST",
      headers:{"Content-Type":"application/json",Authorization:"Bearer "+key},
      body:JSON.stringify({
        model,
        prompt:text,
        size:outputSize,
        quality:String(quality||"auto"),
        n:1,
        output_format:"png"
      })
    });
  }

  const raw=await response.text();
  let data=null;
  try{data=raw?JSON.parse(raw):null}catch{}
  if(!response.ok){
    throw new Error(data?.error?.message||"Image generation failed (HTTP "+response.status+").");
  }

  const item=Array.isArray(data?.data)?data.data[0]:null;
  if(!item) throw new Error("The image provider returned no image.");
  if(item.b64_json) return {ok:true,dataUrl:"data:image/png;base64,"+item.b64_json,model};
  if(item.url) return {ok:true,dataUrl:String(item.url),model};
  throw new Error("The image provider returned an unsupported image response.");
}
