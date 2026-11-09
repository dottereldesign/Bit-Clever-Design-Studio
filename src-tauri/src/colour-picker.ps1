$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
Add-Type -ReferencedAssemblies System.Windows.Forms,System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Windows.Forms;
using System.Runtime.InteropServices;
public class ColourSampler : Form {
 [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
 Bitmap snapshot;
 public string Selected;
 public static string Run() {
  SetProcessDPIAware();
  var area=SystemInformation.VirtualScreen;
  using(var image=new Bitmap(area.Width,area.Height)) {
   using(var graphics=Graphics.FromImage(image)) graphics.CopyFromScreen(area.Left,area.Top,0,0,area.Size);
   using(var form=new ColourSampler(image,area)) {
    using(var timer=new Timer()) {timer.Interval=300000;timer.Tick+=(s,e)=>form.Close();timer.Start();form.ShowDialog();}
    return form.Selected;
   }
  }
 }
 ColourSampler(Bitmap image,Rectangle area) {
  snapshot=image;FormBorderStyle=FormBorderStyle.None;StartPosition=FormStartPosition.Manual;Bounds=area;
  AutoScaleMode=AutoScaleMode.None;TopMost=true;ShowInTaskbar=false;KeyPreview=true;DoubleBuffered=true;Cursor=Cursors.Cross;
  BackgroundImage=image;BackgroundImageLayout=ImageLayout.None;
  KeyDown+=(s,e)=>{if(e.KeyCode==Keys.Escape)Close();};
  MouseDown+=(s,e)=>{if(e.Button==MouseButtons.Right){Close();return;}if(e.Button!=MouseButtons.Left)return;
   int x=Math.Max(0,Math.Min(snapshot.Width-1,e.X)),y=Math.Max(0,Math.Min(snapshot.Height-1,e.Y));
   var c=snapshot.GetPixel(x,y);Selected=String.Format("#{0:X2}{1:X2}{2:X2}",c.R,c.G,c.B);Close();};
 }
}
"@
[ColourSampler]::Run()
