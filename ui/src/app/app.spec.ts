import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute } from '@angular/router';
import { Component } from '@angular/core';
import { App } from './app';
import { of } from 'rxjs';

@Component({
  template: ''
})
class MockComponent { }

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        {
          provide: Router,
          useValue: jasmine.createSpyObj('Router', ['navigate'])
        },
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({}),
            queryParams: of({}),
            snapshot: { params: {}, queryParams: {} }
          }
        }
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should have correct title', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    // Access title through the DOM since it's protected
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('EAI Security Check');
  });

  it('should render navigation', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('nav.navigation')).toBeTruthy();
    expect(compiled.querySelector('h1')?.textContent).toContain('EAI Security Check');
  });
});
