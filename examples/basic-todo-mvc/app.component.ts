import "@angular/compiler";
import "@angular/platform-server";
import "zone.js";

import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ChangeDetectorRef,
  PLATFORM_ID,
} from "@angular/core";
import { CommonModule, isPlatformBrowser } from "@angular/common";
import { MatListModule } from "@angular/material/list";
import { HttpClient } from "@angular/common/http";
import { Subject, interval, switchMap, takeUntil } from "rxjs";
import { MatTableModule } from "@angular/material/table";
import { MatToolbarModule } from "@angular/material/toolbar";
import { MatCardModule } from "@angular/material/card";

export interface Todo {
  id: number;
  title: string;
}

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    CommonModule,
    MatListModule,
    MatTableModule,
    MatToolbarModule,
    MatCardModule,
  ],
  template: `
    <mat-toolbar color="primary">
      <span style="font-size: 1.2em;">Basic To-do example</span>
    </mat-toolbar>
    <div>
      <div style="padding: 16px;">
        <p>
          Source code avaialble on GitHub at:<br /><a
            href="https://github.com/petermetz/openapi-llm-adapter-gemini"
            >&#64;petermetz-fyi/openapi-llm-adapter-gemini</a
          >
        </p>
      </div>
      <mat-card>
        <mat-card-header>
          <mat-card-title>Your Tasks</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <table
            mat-table
            [dataSource]="todos"
            class="mat-elevation-z8"
            style="width: 100%;"
          >
            <ng-container matColumnDef="id">
              <th mat-header-cell *matHeaderCellDef style="font-size: 1.1em;">
                ID
              </th>
              <td mat-cell *matCellDef="let element" style="font-size: 1em;">
                {{ element.id }}
              </td>
            </ng-container>

            <ng-container matColumnDef="title">
              <th mat-header-cell *matHeaderCellDef style="font-size: 1.1em;">
                Title
              </th>
              <td
                mat-cell
                *matCellDef="let element"
                style="font-size: 1em; word-break: break-word;"
              >
                {{ element.title }}
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
          </table>
        </mat-card-content>
      </mat-card>
    </div>
  `,
})
export class AppComponent implements OnInit, OnDestroy {
  todos: Todo[] = [];
  displayedColumns: string[] = ["id", "title"];
  private destroy$ = new Subject<void>();
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private baseUrl = "http://localhost:3000";
  private platformId = inject(PLATFORM_ID);
  private fetchTodos$ = new Subject<void>();

  // FIXME(petermetz): there is no client-side hydration at all, so this is all
  // just dead code for now.
  ngOnInit() {
    console.log("[AppComponent] ngOnInit() running...");

    if (isPlatformBrowser(this.platformId)) {
      console.log(
        "[AppComponent] ngOnInit() running in browser. Will poll data..."
      );
      this.fetchTodos$
        .pipe(
          switchMap(() =>
            this.http.get<Todo[]>(`${this.baseUrl}/todos`)
          ),
          takeUntil(this.destroy$)
        )
        .subscribe((newTodos) => {
          console.log("[AppComponent] received polled data: ", newTodos);
          this.todos = newTodos;
          this.cdr.detectChanges();
        });

      interval(1000)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.fetchTodos$.next();
        });
      this.fetchTodos$.next();
    } else {
      // Server-side: Fetch initial data only
      this.http
        .get<Todo[]>(`${this.baseUrl}/todos`)
        .subscribe((todos) => {
          this.todos = todos;
          this.cdr.detectChanges();
        });
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
