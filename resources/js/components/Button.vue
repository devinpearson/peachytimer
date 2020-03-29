<template>
    <div class="flex row">
        <div id="example-1">
            <button v-on:click="timerOff">Off</button>
        </div>
        <div id="example-2">
            <button v-on:click="timerGreen">Green</button>
        </div>
        <div id="example-3">
            <button v-on:click="timerAmber">Amber</button>
        </div>
        <div id="example-4">
            <button v-on:click="timerRed">Red</button>
        </div>
    </div>
</template>

<script>
    import axios from 'axios';

    const client = axios.create();

    export default {
        data() {
            return {
                saving: false,
                message: false,
                validationErrors: false,
                fields: {
                    name: '',
                    email: '',
                    password: '',
                    password_confirmation: '',
                },

            }
        },
        methods: {
            timerOff($event) {
                this.saving = true;
                this.message = false;
                client.get('api/off', this.fields)
                    .then((response) => {
                        //this.$router.push({ name: 'form' });
                    })
                    .catch((e) => {
                        this.message = e.response.data || 'There was an issue registering.';
                    })
                    .then(() => this.saving = false)
            },
            timerGreen($event) {
                this.saving = true;
                this.message = false;
                client.get('/api/green', this.fields)
                    .then((response) => {
                        //this.$router.push({ name: 'form' });
                    })
                    .catch((e) => {
                        this.message = e.response.data || 'There was an issue registering.';
                    })
                    .then(() => this.saving = false)
            },
            timerAmber($event) {
                this.saving = true;
                this.message = false;
                client.get('/api/amber', this.fields)
                    .then((response) => {
                        //this.$router.push({ name: 'form' });
                    })
                    .catch((e) => {
                        this.message = e.response.data || 'There was an issue registering.';
                    })
                    .then(() => this.saving = false)
            },
            timerRed($event) {
                this.saving = true;
                this.message = false;
                client.get('/api/red', this.fields)
                    .then((response) => {
                        //this.$router.push({ name: 'form' });
                    })
                    .catch((e) => {
                        this.message = e.response.data || 'There was an issue registering.';
                    })
                    .then(() => this.saving = false)
            }
        },
    }

</script>
