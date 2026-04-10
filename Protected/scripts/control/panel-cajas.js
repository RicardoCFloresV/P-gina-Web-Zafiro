/**
 * panel-categorias.js
 * Módulo para gestionar la recolección de datos de los formularios de categorías (Añadir/Editar y Buscar).
 */

document.addEventListener("DOMContentLoaded", () => {
    // Referencias a los elementos del DOM (Añadir / Editar)
    const modalTitle = document.getElementById("modalTitle");
    const modal = document.getElementById("modalCategoria");
    const formCategoria = document.getElementById("formCategoria");

    // Referencias a los elementos del DOM (Buscar)
    const btnCargarRegistros = document.getElementById("btnCargarRegistros");
    const modalBuscar = document.getElementById("modalBuscarCategoria");
    const formBuscarCategoria = document.getElementById("formBuscarCategoria");
  
    // 1. Manejo del formulario de Añadir / Editar
    if (formCategoria) {
      // Escuchamos el evento 'submit' en lugar de 'click'.
      // HTML5 se encargará de detener el submit si falta algún campo "required".
      formCategoria.addEventListener("submit", (e) => {
        e.preventDefault(); // Evitamos recargar la página

        const titleText = modalTitle.innerText.toLowerCase();
        let formActionName = "añadir";
        
        if (titleText.includes("editar") || titleText.includes("modificar")) {
          formActionName = "editar";
        }
  
        const valJerarquia = document.getElementById("modalJerarquia").value;
        const valNombre = document.getElementById("modalNombre").value;
        const valDescripcion = document.getElementById("modalDescripcion").value;
  
        console.log(`Form used name "${formActionName}"`);
        console.log(`element data Jerarquía: "${valJerarquia}"`);
        console.log(`element data Nombre: "${valNombre}"`);
        console.log(`element data Descripción: "${valDescripcion}"`);
        
        if (window.showToast) {
            window.showToast(`Datos de la categoría capturados en consola (${formActionName})`, false);
        }
        
        if (modal) {
            modal.classList.remove('active');
        }
      });
    }

    // 2. Manejo del formulario de Búsqueda
    if (formBuscarCategoria) {
        // Igualmente, escuchamos el submit
        formBuscarCategoria.addEventListener("submit", (e) => {
            e.preventDefault();

            const valSearchJerarquia = document.getElementById("searchJerarquia").value;
            const valSearchId = document.getElementById("searchId").value;
            const valSearchNombre = document.getElementById("searchNombre").value;

            // Validación por JavaScript: Aseguramos que al menos un campo tenga datos para no enviar un form vacío
            if (!valSearchJerarquia && !valSearchId && !valSearchNombre.trim()) {
                if (window.showToast) {
                    window.showToast('Por favor, ingresa al menos un criterio de búsqueda.', true);
                }
                return; // Detenemos la búsqueda
            }

            console.log(`Form used name "buscar"`);
            console.log(`element data Jerarquía: "${valSearchJerarquia}"`);
            console.log(`element data Id: "${valSearchId}"`);
            console.log(`element data Nombre: "${valSearchNombre}"`);

            if (window.showToast) {
                window.showToast('Parámetros de búsqueda capturados en consola', false);
            }

            if (modalBuscar) {
                modalBuscar.classList.remove('active');
            }
        });
    }

    // 3. Manejo de "Cargar todos los registros"
    if (btnCargarRegistros) {
        btnCargarRegistros.addEventListener("click", (e) => {
            e.preventDefault();
            
            console.log(`Action: "cargar todos los registros"`);

            if (window.showToast) {
                window.showToast('Cargando todos los registros de categorías...', false);
            }

            if (modalBuscar) {
                modalBuscar.classList.remove('active');
            }
        });
    }
});