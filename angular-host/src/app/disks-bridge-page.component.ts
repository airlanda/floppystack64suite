import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { FederationLoaderService } from './federation-loader.service';

type DisksBridgeModule = {
  mountFs64DisksBridge: (element: Element, options?: { initialPath?: string }) => void;
  unmountFs64DisksBridge: (element: Element) => void;
};

@Component({
  selector: 'app-disks-bridge-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="interop-page">
      <header class="interop-header">
        <p class="interop-kicker">Angular Host</p>
        <h2>Disks via React Bridge</h2>
        <p>The Angular page resolves the remote from the manifest, then mounts the React disks slice into this container.</p>
      </header>
      <div #mountPoint class="interop-surface"></div>
    </section>
  `,
})
export class DisksBridgePageComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mountPoint', { static: true }) mountPoint!: ElementRef<HTMLElement>;

  private readonly loader = inject(FederationLoaderService);
  private bridge: DisksBridgeModule | null = null;

  async ngAfterViewInit() {
    this.bridge = await this.loader.loadRemoteById<DisksBridgeModule>('disks', './AngularBridge');

    this.bridge.mountFs64DisksBridge(this.mountPoint.nativeElement, {
      initialPath: '/?diskId=1',
    });
  }

  ngOnDestroy() {
    this.bridge?.unmountFs64DisksBridge(this.mountPoint.nativeElement);
  }
}
