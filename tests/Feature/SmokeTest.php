<?php

namespace Tests\Feature;

use App\Events\TimerAmber;
use App\Events\TimerGreen;
use App\Events\TimerOff;
use App\Events\TimerRed;
use App\Events\TimerStarted;
use App\Events\TimerStopped;
use App\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class SmokeTest extends TestCase
{
    use RefreshDatabase;

    public function test_auth_pages_render(): void
    {
        $this->get('/login')->assertOk();
        $this->get('/register')->assertOk();
        $this->get('/password/reset')->assertOk();
    }

    public function test_home_requires_authentication(): void
    {
        $this->get('/home')->assertRedirect('/login');
    }

    public function test_authenticated_user_can_view_home(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->get('/home')->assertOk();
    }

    public function test_user_can_register(): void
    {
        $this->post('/register', [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertRedirect('/home');

        $this->assertAuthenticated();
    }

    public function test_timer_routes_dispatch_broadcast_events(): void
    {
        Event::fake();

        $this->get('/event')->assertOk();
        $this->get('/event2')->assertOk();
        $this->get('/api/off')->assertOk();
        $this->get('/api/green')->assertOk();
        $this->get('/api/amber')->assertOk();
        $this->get('/api/red')->assertOk();

        foreach ([TimerStarted::class, TimerStopped::class, TimerOff::class, TimerGreen::class, TimerAmber::class, TimerRed::class] as $event) {
            Event::assertDispatched($event);
        }
    }

    public function test_timer_events_broadcast_with_log_driver(): void
    {
        config(['broadcasting.default' => 'log']);

        $this->get('/api/green')->assertOk();
        $this->get('/event')->assertOk();
    }

    public function test_timer_event_payload(): void
    {
        $event = new TimerStarted('Hello World');

        $this->assertSame(['my-channel'], $event->broadcastOn());
        $this->assertSame('timer-started', $event->broadcastAs());
        $this->assertSame('Started', $event->message->message->content);
    }
}
