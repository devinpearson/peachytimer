let actions = {
    ADD_MESSAGE({commit}, message) {

        return new Promise((resolve, reject) => {
            axios.post(`/messages`, message)
                .then(response => {
                    resolve(response)
                }).catch(err => {
                reject(err)
            })
        })
    },

    GET_MESSAGES({commit}) {
        axios.get('/messages')
            .then(res => {
                {
                    commit('GET_MESSAGES', res.data)
                }
            })
            .catch(err => {
                console.log(err)
            })
    }
}

export default actions
