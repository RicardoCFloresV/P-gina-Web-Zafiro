/**
 * panel-usuarios.js
 * Módulo para gestionar la recolección de datos de los formularios de usuarios.
 */

document.addEventListener("DOMContentLoaded", () => {
    // Referencias a los elementos del DOM
    const btnAccionModal = document.getElementById("btnAccionModal");
    const modalTitle = document.getElementById("modalTitle");
    const modal = document.getElementById("modalUsuario");
  
    // Verificamos que el botón exista
    if (btnAccionModal) {
      btnAccionModal.addEventListener("click", (e) => {
        e.preventDefault();
  
        // 1. Determinar qué acción se está realizando
        const titleText = modalTitle.innerText.toLowerCase();
        let formActionName = "añadir";
        
        if (titleText.includes("editar") || titleText.includes("modificar")) {
          formActionName = "editar";
        }
  
        // 2. Obtener los datos de los inputs del formulario
        const valNombre = document.getElementById("modalNombre").value;
        const valEmail = document.getElementById("modalEmail").value;
        const valRol = document.getElementById("modalRol").value;
        const valPassword = document.getElementById("modalPassword").value;
  
        // 3. Imprimir los resultados en la consola (Formato solicitado)
        console.log(`Form used name "${formActionName}"`);
        console.log(`element data Nombre: "${valNombre}"`);
        console.log(`element data Email: "${valEmail}"`);
        console.log(`element data Rol: "${valRol}"`);
        console.log(`element data Password: "${valPassword ? '***(Ingresada)***' : '(Vacia)'}"`); // Enmascaramos por seguridad visual, pero capturamos el evento
        
        // 4. Mostrar alerta / Toast y cerrar modal
        if (window.showToast) {
            window.showToast('Datos del usuario capturados en consola', false);
        }
        
        if (modal) {
            modal.classList.remove('active');
        }
      });
    }
});