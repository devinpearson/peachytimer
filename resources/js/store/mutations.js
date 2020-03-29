let mutations = {
    GET_MESSAGES(state, messages) {
        state.messages = messages
    },
    ADD_MESSAGE(state, message) {
        state.messages = [...state.messages, message]
    },
    SET_COLOUR(state, colour) {
        state.bgc.backgroundColor = colour
    }
}

export default mutations
