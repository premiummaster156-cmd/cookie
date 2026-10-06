import React from "react";
import {ArrowLeft,LockKeyhole,ShieldCheck} from "lucide-react";
export default function LegalPage({kind,onBack}:{kind:"terms"|"privacy";onBack:()=>void}){
 const privacy=kind==="privacy";return <div className="legal-page"><header className="legal-head"><button onClick={onBack}><ArrowLeft size={17}/>Help Center</button><div><b>Cookie</b><span>{privacy?"Privacy Policy":"Terms of Service"}</span></div></header>
 <article className="legal-document"><div className="legal-kicker">{privacy?<LockKeyhole size={16}/>:<ShieldCheck size={16}/>} COOKIE</div><h1>{privacy?"Privacy Policy":"Terms of Service"}</h1><p className="legal-updated">Effective October 6, 2026</p>{privacy?<PrivacyBody/>:<TermsBody/>}</article></div>;
}
function TermsBody(){return <div className="legal-copy">
<h2>1. Using Cookie</h2><p>Cookie is an AI service for conversation, research, files, coding, and related productivity features. By using Cookie, you agree to these Terms and to use the service lawfully and responsibly.</p>
<h2>2. Your account</h2><p>You are responsible for keeping your account credentials secure and for activity performed through your account. Provide accurate information and do not use another person's account without permission.</p>
<h2>3. Your content</h2><p>You keep ownership of content you submit to Cookie, subject to the rights needed to operate the service. You are responsible for having the rights and permissions needed to upload or share that content.</p>
<h2>4. Cookie outputs</h2><p>AI output can be wrong, incomplete, outdated, or unsuitable for your situation. Review important output before relying on it. Cookie is not a substitute for qualified professional advice in high-stakes matters.</p>
<h2>5. Acceptable use</h2><p>Do not use Cookie to break the law, harm people, commit fraud, abuse or attack systems, bypass access controls, distribute malware, or interfere with the service. Do not attempt to access accounts, data, or systems without authorization.</p>
<h2>6. Service changes</h2><p>Cookie may add, remove, or change features, models, limits, and availability. We may temporarily restrict or suspend access to protect users, the service, or security.</p>
<h2>7. Plans and payments</h2><p>Where paid plans are offered, the applicable price, renewal, cancellation, and refund terms shown at purchase apply. Features and limits can differ by plan.</p>
<h2>8. Suspension and termination</h2><p>We may suspend or terminate access when reasonably necessary for violations of these Terms, security, fraud prevention, or legal obligations. You may stop using Cookie at any time.</p>
<h2>9. Disclaimers</h2><p>Cookie is provided on an as-available basis. To the extent permitted by law, we do not guarantee that the service will always be uninterrupted, error-free, or that every output will be accurate.</p>
<h2>10. Changes to these Terms</h2><p>We may update these Terms when the service or legal requirements change. The current version is published in Cookie's Help Center. Continued use after an update means you accept the updated Terms to the extent permitted by law.</p>
<h2>11. Contact</h2><p>For account, privacy, or legal questions, use the support contact provided by Cookie or the account support channel available to you.</p>
</div>}
function PrivacyBody(){return <div className="legal-copy">
<h2>1. What we collect</h2><p>Cookie may process information you provide, such as your account details, messages, files, images, profile information, and settings. It may also process technical information needed to operate, secure, and improve the service, such as device, browser, network, and usage information.</p>
<h2>2. How we use information</h2><p>We use information to provide Cookie, authenticate accounts, respond to requests, maintain features, prevent abuse, protect security, troubleshoot problems, and meet legal obligations.</p>
<h2>3. AI processing</h2><p>Content you send to Cookie may be processed by the AI and other infrastructure required to provide the requested feature. Do not submit secrets or information you are not authorized to share.</p>
<h2>4. Memory</h2><p>When Memory features are enabled, Cookie may retain selected information to make future conversations more useful. You can review or remove saved memory through available Memory controls. Removing a memory does not necessarily remove the original conversation.</p>
<h2>5. Sharing</h2><p>We may share information with service providers and infrastructure partners when needed to operate Cookie, and when required by law or to protect users and the service. We do not make your private conversations public unless you choose a sharing feature or disclosure is otherwise required.</p>
<h2>6. Security</h2><p>We use reasonable technical and organizational measures designed to protect information. No internet service can guarantee absolute security, so protect your account and avoid submitting unnecessary secrets.</p>
<h2>7. Retention</h2><p>Information may be retained for as long as needed to provide the service, maintain security, resolve disputes, enforce rules, or meet legal and operational requirements. Retention can differ by feature and type of record.</p>
<h2>8. Your choices</h2><p>Depending on the feature and applicable law, you may be able to access, correct, delete, or control certain information through Cookie settings or by contacting support.</p>
<h2>9. Children</h2><p>Cookie is not intended for children who are not permitted to use the service under applicable law. Do not create an account or submit personal information if you are not eligible to use Cookie.</p>
<h2>10. Changes</h2><p>We may update this Privacy Policy when our practices or legal requirements change. The current version is published in Cookie's Help Center.</p>
<h2>11. Contact</h2><p>For privacy questions or requests, use the support contact provided by Cookie or the account support channel available to you.</p>
</div>}