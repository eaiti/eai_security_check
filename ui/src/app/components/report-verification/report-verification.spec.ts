import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReportVerification } from './report-verification';

describe('ReportVerification', () => {
  let component: ReportVerification;
  let fixture: ComponentFixture<ReportVerification>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportVerification]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReportVerification);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
