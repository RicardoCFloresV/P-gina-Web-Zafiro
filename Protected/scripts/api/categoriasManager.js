// API para gestión de categorías (todos los niveles: 1 = Principal, 2 = Secundaria, 3 = Subcategoría)
const categoriasAPI = {
    
    async getAll() {
        const response = await fetch('/categorias/get_all', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        return await response.json();
    },

    async getById(id) {
        const response = await fetch(`/categorias/por_id/${id}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        return await response.json();
    },

    async insert(data) {
        // data debe contener: { nombre: string, nivel: number (1,2,3), categoria_padre_id: number | null }
        const response = await fetch('/categorias/insert', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        return await response.json();
    },

    async update(data) {
        // data debe contener: { categoria_id: number, nombre: string, estado: boolean|0|1 }
        const response = await fetch('/categorias/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        return await response.json();
    },

    async setState(id, estado) {
        // Reemplaza a los antiguos métodos de eliminación (remove)
        // estado: true/1 (activar), false/0 (desactivar)
        const response = await fetch('/categorias/set_state', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ categoria_id: id, estado: estado })
        });
        return await response.json();
    }
};

export { categoriasAPI };