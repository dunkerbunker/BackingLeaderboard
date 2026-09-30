export function demoAdArt(name: string, color: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="600" viewBox="0 0 1000 600">
  <rect width="1000" height="600" fill="${color}"/><circle cx="920" cy="30" r="230" fill="#fff" opacity=".24"/><circle cx="10" cy="540" r="220" fill="#fff" opacity=".15"/>
  <text x="62" y="85" font-size="22" font-weight="700" font-family="Arial" fill="#163e30">${name}</text><text x="62" y="142" font-size="12" letter-spacing="3" font-family="Arial" fill="#385648">A LITTLE IDEA. A BIGGER POSSIBILITY.</text>
  <rect x="70" y="183" width="850" height="340" rx="18" fill="#163e30" opacity=".12"/><rect x="60" y="170" width="880" height="340" rx="18" fill="#f9fcf5"/><path d="M60 218h880" stroke="#d7e2cf"/>
  <circle cx="86" cy="194" r="5" fill="#b9c8ac"/><circle cx="104" cy="194" r="5" fill="#b9c8ac"/><circle cx="122" cy="194" r="5" fill="#b9c8ac"/><text x="500" y="199" text-anchor="middle" font-size="14" font-family="Arial" fill="#496441">${name} / Launch workspace</text>
  <text x="98" y="272" font-size="26" font-weight="700" font-family="Arial" fill="#163e30">Good things start small.</text><text x="98" y="299" font-size="14" font-family="Arial" fill="#586e4d">Your idea. Your people. Your next chapter.</text>
  <rect x="100" y="327" width="235" height="140" rx="12" fill="${color}" opacity=".65"/><rect x="354" y="327" width="235" height="140" rx="12" fill="#e8efde"/><rect x="608" y="327" width="294" height="140" rx="12" fill="#163e30"/>
  <text x="124" y="364" font-size="14" font-weight="700" font-family="Arial" fill="#163e30">MAKE SOMETHING</text><path d="M125 391h161m-161 24h128m-128 24h81" stroke="#5d7550" stroke-width="7" stroke-linecap="round" opacity=".5"/>
  <text x="378" y="364" font-size="14" font-weight="700" font-family="Arial" fill="#163e30">FIND YOUR PEOPLE</text><circle cx="395" cy="410" r="21" fill="${color}"/><circle cx="435" cy="410" r="21" fill="#d3e4ba"/><circle cx="475" cy="410" r="21" fill="#b8d89e"/>
  <text x="632" y="364" font-size="14" font-weight="700" font-family="Arial" fill="#ddefb0">READY WHEN YOU ARE</text><text x="632" y="414" font-size="34" font-family="Arial" fill="#fff">Let’s launch.</text><path d="M847 410h28m-12-12 12 12-12 12" fill="none" stroke="#ddefb0" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="60" y="562" font-size="13" letter-spacing="2" font-family="Arial" fill="#385648">FICTIONAL SPONSOR · STAGING PREVIEW</text></svg>`;
}
