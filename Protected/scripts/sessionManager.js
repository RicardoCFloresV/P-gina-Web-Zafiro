// sessionManager.js
// Script global para gestionar la visualización de la sesión y el cierre de sesión.

document.addEventListener('DOMContentLoaded', () => {
  // 1. Elementos del DOM a actualizar (Header Desktop)
  const headerUsername = document.getElementById('header-username');
  const headerRole     = document.getElementById('header-role');
  const headerAvatar   = document.getElementById('header-avatar');
  
  // 2. Elementos del DOM a actualizar (Sidebar Mobile)
  const sidebarUsername = document.getElementById('sidebar-username');
  const sidebarRole     = document.getElementById('sidebar-role');
  const sidebarAvatar   = document.getElementById('sidebar-avatar');

  // 3. Botón de Logout
  const logoutBtn = document.getElementById('logout-btn');

  // ═════════════════════════════════════════════════════════════════════════════
  //  A. CARGAR DATOS DEL USUARIO
  // ═════════════════════════════════════════════════════════════════════════════
  // Intentamos obtener los datos del usuario desde localStorage 
  // (Debes asegurarte de guardar 'userData' en el momento en que haces Login)
  const rawData = localStorage.getItem('userData'); 
  
  if (rawData) {
    try {
      const userData = JSON.parse(rawData);
      
      // Ajusta las propiedades 'nombre' y 'rol' según como las devuelva tu API de Login
      const name = userData.nombre || userData.username || 'Usuario';
      const role = userData.isAdmin ? 'Super Administrador' : (userData.rol || 'Usuario Regular');
      const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2d4778&color=fff`;

      // Renderizar en Header
      if (headerUsername) headerUsername.textContent = name;
      if (headerRole) headerRole.textContent = role;
      if (headerAvatar) headerAvatar.src = avatarUrl;

      // Renderizar en Sidebar
      if (sidebarUsername) sidebarUsername.textContent = name;
      if (sidebarRole) sidebarRole.textContent = role;
      if (sidebarAvatar) sidebarAvatar.src = avatarUrl;

    } catch (e) {
      console.error('Error al parsear datos de sesión:', e);
    }
  } else {
    // Si no hay datos en localStorage, podrías redirigir al index por seguridad
    // window.location.replace('/index.html');
  }

  // ═════════════════════════════════════════════════════════════════════════════
  //  B. CERRAR SESIÓN
  // ═════════════════════════════════════════════════════════════════════════════
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      
      // Evitar múltiples clics
      const originalText = logoutBtn.innerHTML;
      logoutBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saliendo...';
      logoutBtn.disabled = true;

      try {
        // Llamada a tu ruta de logout configurada en authRouter.js
        const res = await fetch('/api/auth/logout', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await res.json();
        
        if (res.ok && data.success) {
          // Limpiar local y session storage
          localStorage.removeItem('userData');
          sessionStorage.clear();
          
          // Redirigir al home/login (basado en lo que devuelve authRouter)
          window.location.replace(data.redirect || '/index.html');
        } else {
          alert('Error al cerrar sesión: ' + (data.message || 'Desconocido'));
          logoutBtn.innerHTML = originalText;
          logoutBtn.disabled = false;
        }
      } catch (err) {
        console.error('Error al hacer logout:', err);
        alert('No hay conexión con el servidor para cerrar sesión.');
        logoutBtn.innerHTML = originalText;
        logoutBtn.disabled = false;
      }
    });
  }
});