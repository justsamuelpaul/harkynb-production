const form=document.querySelector('#setup'), result=document.querySelector('#result');
const invite=new URLSearchParams(location.hash.slice(1));
if (invite.has('token')) {
  form.elements.token.value=invite.get('token');
  form.elements.name.value=invite.get('name') || '';
  history.replaceState(null,'',location.pathname);
}
form.addEventListener('submit',async event=>{
  event.preventDefault();
  const {name,token,password,confirmation}=form.elements;
  if (password.value!==confirmation.value) {result.textContent='The passwords do not match.';confirmation.focus();return;}
  const button=form.querySelector('button');button.disabled=true;
  try {
    const response=await fetch('/staff/activate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name.value.trim(),token:token.value.trim(),password:password.value})});
    const reply=await response.json();
    if (!response.ok || !reply.saved) throw Error(reply.error || 'Activation failed.');
    form.reset();form.hidden=true;result.textContent='Your password is ready. Sign in with your username and the password you just chose.';
    document.querySelector('#signin').hidden=false;
  } catch (error) { result.textContent=error.message || 'Could not connect. Please try again.'; }
  finally {button.disabled=false;}
});
