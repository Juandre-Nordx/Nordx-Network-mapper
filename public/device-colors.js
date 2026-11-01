export function deviceColor(node,fallback='#ffffff'){
 return /^#[0-9a-f]{6}$/i.test(node.color||'')?node.color.toLowerCase():fallback;
}
export function deviceTextColor(color){
 const channels=color.slice(1).match(/../g).map(value=>parseInt(value,16)/255).map(value=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4);
 const luminance=channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722;
 return (luminance+0.05)/0.05>=1.05/(luminance+0.05)?'#000000':'#ffffff';
}
