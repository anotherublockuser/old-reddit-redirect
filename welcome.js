const api = globalThis.browser ?? globalThis.chrome;

const origins = api.runtime.getManifest().host_permissions;

const grant = document.getElementById("grant");

grant.addEventListener("click", async () => {
  const granted = await api.permissions.request({ origins });

  if (!granted) {
    return;
  }

  grant.parentElement.style.display = "none";
  document.getElementById("done").style.display = "block";
});
