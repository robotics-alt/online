// Limit uplink demand without reacquiring the camera or replacing its stream.
export async function tuneClassroomSenders(pc:RTCPeerConnection,quality:'good'|'weak'|'poor'|'unknown'='good',sharing=false){
  for(const sender of pc.getSenders()){
    if(!sender.track)continue
    const params=sender.getParameters()
    if(!params.encodings?.length)continue
    const video=sender.track.kind==='video',bitrate=video?(sharing?1200000:quality==='poor'?300000:quality==='weak'?550000:900000):64000,fps=sharing?15:quality==='poor'?15:24
    if(params.encodings.every(e=>e.maxBitrate===bitrate&&(!video||e.maxFramerate===fps)))continue
    for(const encoding of params.encodings){encoding.maxBitrate=bitrate;if(video)encoding.maxFramerate=fps}
    if(video)params.degradationPreference=sharing?'maintain-resolution':'balanced'
    try{await sender.setParameters(params)}catch{/* Retry on the next quality sample once negotiation completes. */}
  }
}
