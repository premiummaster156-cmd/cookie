import { json, readJson } from "./_lib.js";
import { dbAvailable, getSessionUser } from "./auth/_auth.js";
import { generateImage } from "./_images.js";

export async function onRequestPost({request,env}){
  if(!dbAvailable(env)) return json({error:"Cookie database is not connected."},503);
  const user=await getSessionUser(request,env);
  if(!user) return json({error:"Authentication required."},401);
  try{
    const body=await readJson(request);
    const result=await generateImage(env,{
      prompt:body?.prompt,
      size:body?.size,
      quality:body?.quality,
      imageData:typeof body?.imageData==="string"?body.imageData:""
    });
    return json(result);
  }catch(error){
    console.error("[Cookie image]",error);
    return json({error:String(error?.message||"Image generation failed.")},502);
  }
}
