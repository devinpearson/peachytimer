<template>
    <div class="container">
        <ul class="comment-list">
            <Message :key="message.id" v-for="message in messages" :message="message"></Message>
        </ul>
    </div>
</template>

<script>
    import {mapGetters} from 'vuex'
    import Message from './Message'

    export default {
        name: "Messages",
        components: {Message},
        mounted() {
            this.$store.dispatch('GET_MESSAGES')

            //use your own credentials you get from Pusher
            let pusher = new Pusher(`b680f25cca77d3dfc10a`, {
                broadcaster: 'pusher',
                cluster: 'eu',
                forceTLS: true
            });

            //Subscribe to the channel we specified in our Adonis Application
            let channel = pusher.subscribe('my-channel');

            channel.bind('timer-off', (data) => {
                this.$store.commit('ADD_MESSAGE', data.message.message);
                this.$store.commit('SET_COLOUR', 'black')
            })

            channel.bind('timer-green', (data) => {
                this.$store.commit('ADD_MESSAGE', data.message.message);
                this.$store.commit('SET_COLOUR', 'green')
            })

            channel.bind('timer-amber', (data) => {
                this.$store.commit('ADD_MESSAGE', data.message.message);
                this.$store.commit('SET_COLOUR', 'orange')
            })

            channel.bind('timer-red', (data) => {
                this.$store.commit('ADD_MESSAGE', data.message.message);
                this.$store.commit('SET_COLOUR', 'red')
            })
        },
        computed: {
            ...mapGetters([
                'messages'
            ])
        }
    }
</script>
